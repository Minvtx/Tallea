import fs from "node:fs";
import type {
  CycleOutput,
  GenerationMetadata,
  TimelineEvent,
  WorldLogEntry,
  WorldState,
} from "@/types/world";
import { applyDelta } from "@/lib/delta";
import {
  CANON_DIR,
  CURRENT_STATE_PATH,
  CYCLE_RULES_PATH,
  CYCLES_DIR,
  DATA_DIR,
  EVENT_TYPES_PATH,
  FIRST_CYCLE_SEED_PATH,
  GENERATION_LOG_PATH,
  INITIAL_STATE_PATH,
  LOG_PATH,
  RUNTIME_DIR,
  RUNTIME_FOUNDATION_PATH,
  SEED_DIR,
  STATE_SCHEMA_PATH,
  TIMELINE_PATH,
  WORLD_RULES_PATH,
  getWorldStore,
} from "@/lib/world-store";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export {
  CANON_DIR,
  CURRENT_STATE_PATH,
  CYCLE_RULES_PATH,
  CYCLES_DIR,
  DATA_DIR,
  EVENT_TYPES_PATH,
  FIRST_CYCLE_SEED_PATH,
  GENERATION_LOG_PATH,
  INITIAL_STATE_PATH,
  LOG_PATH,
  RUNTIME_DIR,
  RUNTIME_FOUNDATION_PATH,
  SEED_DIR,
  STATE_SCHEMA_PATH,
  TIMELINE_PATH,
  WORLD_RULES_PATH,
};

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function readMd(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

export { applyDelta };

// ---------------------------------------------------------------------------
// Cycle output enumeration
// ---------------------------------------------------------------------------

export async function listCycleOutputFiles(): Promise<string[]> {
  const cycles = await getWorldStore().loadCycleOutputs();
  return cycles.map((cycle) => `${cycle.cycle_id}_output.json`).sort();
}

export async function loadCycleOutputs(): Promise<CycleOutput[]> {
  return getWorldStore().loadCycleOutputs();
}

export async function loadLatestCycleOutput(): Promise<CycleOutput | null> {
  return getWorldStore().loadLatestCycleOutput();
}

// ---------------------------------------------------------------------------
// World state loaders
// ---------------------------------------------------------------------------

export async function loadInitialState(): Promise<WorldState | null> {
  return getWorldStore().loadInitialState();
}

export async function loadCurrentWorldState(): Promise<WorldState | null> {
  return getWorldStore().loadCurrentWorldState();
}

// ---------------------------------------------------------------------------
// Timeline loader
// ---------------------------------------------------------------------------

export async function loadTimeline(): Promise<TimelineEvent[]> {
  return getWorldStore().loadTimeline();
}

// ---------------------------------------------------------------------------
// World log / Daybook loader
// ---------------------------------------------------------------------------

export async function loadWorldLog(): Promise<WorldLogEntry[]> {
  return getWorldStore().loadWorldLog();
}

// ---------------------------------------------------------------------------
// Generation metadata loader (per-cycle: actual mode, model, duration, ...)
// ---------------------------------------------------------------------------

export async function loadGenerationLog(): Promise<GenerationMetadata[]> {
  return getWorldStore().loadGenerationLog();
}

export async function loadLatestGeneration(): Promise<GenerationMetadata | null> {
  const log = await loadGenerationLog();
  return log.length > 0 ? log[log.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Runtime doc loaders (markdown, for the orchestrator prompt)
// ---------------------------------------------------------------------------

export function loadRuntimeFoundation(): string {
  return readMd(RUNTIME_FOUNDATION_PATH);
}
export function loadCycleRules(): string {
  return readMd(CYCLE_RULES_PATH);
}
export function loadEventTypes(): string {
  return readMd(EVENT_TYPES_PATH);
}
export function loadStateSchema(): string {
  return readMd(STATE_SCHEMA_PATH);
}
export function loadFirstCycleSeed(): string {
  return readMd(FIRST_CYCLE_SEED_PATH);
}
export function loadWorldRules(): string {
  return readMd(WORLD_RULES_PATH);
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function getLastUpdatedAt(): Promise<string | null> {
  return getWorldStore().getLastUpdatedAt();
}
