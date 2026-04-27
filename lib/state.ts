import fs from "node:fs";
import path from "node:path";
import type {
  CleanupBurden,
  CycleOutput,
  InternalAlignment,
  MerchantPipelineStatus,
  PublicLegitimacy,
  RunwayPressure,
  StrategicIdentity,
  TimelineEvent,
  WorldLogEntry,
  WorldState,
} from "@/types/world";
import {
  applyDelta,
  CURRENT_STATE_PATH,
  CYCLES_DIR,
  LOG_PATH,
  TIMELINE_PATH,
  loadTimeline,
  loadWorldLog,
} from "@/lib/loaders";
import { deriveBaselineLogEntries, mergeCycleLogEntries } from "@/lib/log";

function writeJson(p: string, data: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Realism guardrails: clamp single-cycle moves on critical ladders to ±1 step.
//
// This is intentionally lightweight. It does not stop the simulation from
// telling a story; it stops it from teleporting through it.
// ---------------------------------------------------------------------------

const PUBLIC_LEGITIMACY_LADDER: PublicLegitimacy[] = [
  "damaged",
  "cold",
  "fragile_warm",
  "rising",
  "overexposed",
];
const RUNWAY_PRESSURE_LADDER: RunwayPressure[] = [
  "low",
  "medium",
  "medium_high",
  "high",
  "critical",
];
const INTERNAL_ALIGNMENT_LADDER: InternalAlignment[] = [
  "fractured",
  "openly_split",
  "functional_but_split",
  "aligned",
];
const CLEANUP_LADDER: CleanupBurden[] = [
  "low",
  "medium",
  "high",
  "unsustainable",
];
// Pipeline progression: linear forward path. `stalled` is treated as a
// side-state and is left unclamped.
const PIPELINE_PROGRESS: MerchantPipelineStatus[] = [
  "none",
  "early_interest",
  "pilot_conversation",
  "active_pilot",
  "paid_pilot",
];

function clampLadder<T extends string>(
  prev: T | undefined,
  next: T | undefined,
  ladder: readonly T[],
  maxStep = 1,
): T | undefined {
  if (next === undefined || next === prev) return next;
  if (prev === undefined) return next;
  const pi = ladder.indexOf(prev);
  const ni = ladder.indexOf(next);
  // If either value is off-ladder (e.g. a string that does not match any rung),
  // we don't second-guess the orchestrator. Many qualitative fields permit
  // free-form strings by design.
  if (pi === -1 || ni === -1) return next;
  if (Math.abs(ni - pi) <= maxStep) return next;
  const direction = ni > pi ? 1 : -1;
  const clamped = ladder[pi + direction * maxStep];
  console.log(
    `[realism-clamp] ${prev} -> ${next} clamped to ${clamped} on ladder [${ladder.join(",")}]`,
  );
  return clamped;
}

/**
 * Apply realism guardrails to a state that has just been mutated by a cycle
 * delta. Returns a possibly-adjusted state. Pure: never touches disk.
 */
export function clampStateTransitions(
  prev: WorldState,
  next: WorldState,
): WorldState {
  const adjusted: WorldState = {
    ...next,
    company_state: { ...next.company_state },
    product_state: { ...next.product_state },
    traction_state: {
      ...next.traction_state,
      merchant_pipeline: { ...next.traction_state.merchant_pipeline },
    },
  };

  // company_state ladders
  adjusted.company_state.public_legitimacy =
    clampLadder(
      prev.company_state.public_legitimacy,
      next.company_state.public_legitimacy,
      PUBLIC_LEGITIMACY_LADDER,
    ) ?? next.company_state.public_legitimacy;

  adjusted.company_state.runway_pressure =
    clampLadder(
      prev.company_state.runway_pressure,
      next.company_state.runway_pressure,
      RUNWAY_PRESSURE_LADDER,
    ) ?? next.company_state.runway_pressure;

  adjusted.company_state.internal_alignment =
    clampLadder(
      prev.company_state.internal_alignment,
      next.company_state.internal_alignment,
      INTERNAL_ALIGNMENT_LADDER,
    ) ?? next.company_state.internal_alignment;

  // strategic_identity may be free-form; only clamp if both values fit a
  // simple "user_led -> contested -> merchant_led/infrastructure_pulled"
  // mental model. Leave free-form strings alone.
  const strategicLadder: StrategicIdentity[] = [
    "user_led",
    "externally_clear_internally_contested",
    "contested",
    "merchant_led",
    "infrastructure_pulled",
  ];
  adjusted.company_state.strategic_identity =
    clampLadder(
      prev.company_state.strategic_identity as StrategicIdentity,
      next.company_state.strategic_identity as StrategicIdentity,
      strategicLadder,
    ) ?? next.company_state.strategic_identity;

  // product_state.manual_cleanup_burden
  adjusted.product_state.manual_cleanup_burden =
    clampLadder(
      prev.product_state.manual_cleanup_burden,
      next.product_state.manual_cleanup_burden,
      CLEANUP_LADDER,
    ) ?? next.product_state.manual_cleanup_burden;

  // merchant_pipeline.status: prevent skipping pilot_conversation
  const prevPipeline = prev.traction_state.merchant_pipeline.status as MerchantPipelineStatus;
  const nextPipeline = next.traction_state.merchant_pipeline.status as MerchantPipelineStatus;
  if (
    PIPELINE_PROGRESS.includes(prevPipeline) &&
    PIPELINE_PROGRESS.includes(nextPipeline)
  ) {
    const clamped =
      clampLadder(prevPipeline, nextPipeline, PIPELINE_PROGRESS) ?? nextPipeline;
    adjusted.traction_state.merchant_pipeline.status = clamped;
  }

  return adjusted;
}

/**
 * Persist a cycle output to data/cycles/cycle_NNN_output.json.
 */
export function writeCycleOutput(cycle: CycleOutput): string {
  fs.mkdirSync(CYCLES_DIR, { recursive: true });
  const fileName = `${cycle.cycle_id}_output.json`;
  const fullPath = path.join(CYCLES_DIR, fileName);
  writeJson(fullPath, cycle);
  return fullPath;
}

/**
 * Apply a cycle to the given state, persist current_state.json, append a
 * compact TimelineEvent to timeline.json, and append the derived
 * WorldLogEntry[] for this cycle to log.json.
 *
 * Timeline = highlight per cycle. Log = fuller daybook per cycle.
 *
 * Log entries are derived deterministically from the CycleOutput. If the
 * orchestrator attached `cycle.logEntries` (mock or AI), those are merged
 * on top. There is no second LLM call.
 */
export function applyAndPersistCycle(
  prevState: WorldState,
  cycle: CycleOutput,
): {
  nextState: WorldState;
  timelineEvent: TimelineEvent;
  logEntries: WorldLogEntry[];
} {
  const merged = applyDelta(prevState, cycle.state_updates);
  // Realism guardrails: prevent single-cycle teleport on key ladders.
  const nextState = clampStateTransitions(prevState, merged);
  nextState.world.day = cycle.day;

  writeJson(CURRENT_STATE_PATH, nextState);

  const timelineEvent: TimelineEvent = {
    cycle_id: cycle.cycle_id,
    day: cycle.day,
    title: cycle.title,
    trigger: cycle.trigger,
    outcome: cycle.outcome,
    residue: cycle.residue,
    affected_characters: Array.from(
      new Set(cycle.threads.flatMap((t) => t.affected_characters)),
    ),
    carries_forward: (cycle.state_updates.pending_consequences_added ?? []).map(
      (c) => c.description,
    ),
    primary_pressure: cycle.primary_pressure,
  };

  const existingTimeline = loadTimeline();
  writeJson(TIMELINE_PATH, [...existingTimeline, timelineEvent]);

  // Daybook: derive baseline + merge any orchestrator-attached entries.
  const baseline = deriveBaselineLogEntries(cycle, prevState);
  const logEntries = mergeCycleLogEntries(cycle, baseline);

  const existingLog = loadWorldLog();
  // Re-runs of the same cycle_id should overwrite that cycle's entries
  // rather than duplicate. This keeps the daybook idempotent under
  // accidental double-runs.
  const filtered = existingLog.filter((e) => e.cycle_id !== cycle.cycle_id);
  writeJson(LOG_PATH, [...filtered, ...logEntries]);

  return { nextState, timelineEvent, logEntries };
}

/**
 * Reset persisted runtime state. Canon, runtime, and seed are never touched.
 * Idempotent.
 */
export function resetWorldState(): void {
  try {
    if (fs.existsSync(CURRENT_STATE_PATH)) fs.unlinkSync(CURRENT_STATE_PATH);
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(TIMELINE_PATH)) fs.unlinkSync(TIMELINE_PATH);
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(LOG_PATH)) fs.unlinkSync(LOG_PATH);
  } catch {
    // ignore
  }
  try {
    if (fs.existsSync(CYCLES_DIR)) {
      for (const entry of fs.readdirSync(CYCLES_DIR)) {
        if (entry.startsWith("cycle_") && entry.endsWith("_output.json")) {
          try {
            fs.unlinkSync(path.join(CYCLES_DIR, entry));
          } catch {
            // ignore
          }
        }
      }
    }
  } catch {
    // ignore
  }
}
