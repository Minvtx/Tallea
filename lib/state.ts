import fs from "node:fs";
import path from "node:path";
import type { CycleOutput, TimelineEvent, WorldState } from "@/types/world";
import {
  applyDelta,
  CURRENT_STATE_PATH,
  CYCLES_DIR,
  TIMELINE_PATH,
  loadTimeline,
} from "@/lib/loaders";

function writeJson(p: string, data: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
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
 * Apply a cycle to the given state, persist current_state.json, and append a
 * compact TimelineEvent to timeline.json. Returns the resulting state.
 */
export function applyAndPersistCycle(
  prevState: WorldState,
  cycle: CycleOutput,
): { nextState: WorldState; timelineEvent: TimelineEvent } {
  const nextState = applyDelta(prevState, cycle.state_updates);
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

  const existing = loadTimeline();
  writeJson(TIMELINE_PATH, [...existing, timelineEvent]);

  return { nextState, timelineEvent };
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
