import fs from "node:fs";
import path from "node:path";
import type {
  CycleOutput,
  GenerationMetadata,
  TimelineEvent,
  WorldLogEntry,
  WorldState,
  WorldStateDelta,
} from "@/types/world";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const CANON_DIR = path.join(DATA_DIR, "canon");
export const RUNTIME_DIR = path.join(DATA_DIR, "runtime");
export const SEED_DIR = path.join(DATA_DIR, "seed");
export const CYCLES_DIR = path.join(DATA_DIR, "cycles");
export const CURRENT_STATE_PATH = path.join(DATA_DIR, "current_state.json");
export const TIMELINE_PATH = path.join(DATA_DIR, "timeline.json");
export const LOG_PATH = path.join(DATA_DIR, "log.json");
export const GENERATION_LOG_PATH = path.join(DATA_DIR, "generation_log.json");
export const INITIAL_STATE_PATH = path.join(SEED_DIR, "initial_state.json");
export const FIRST_CYCLE_SEED_PATH = path.join(SEED_DIR, "first_cycle_seed.md");
export const RUNTIME_FOUNDATION_PATH = path.join(RUNTIME_DIR, "runtime_foundation.md");
export const CYCLE_RULES_PATH = path.join(RUNTIME_DIR, "cycle_generation_rules.md");
export const EVENT_TYPES_PATH = path.join(RUNTIME_DIR, "event_types.md");
export const STATE_SCHEMA_PATH = path.join(RUNTIME_DIR, "state_schema.md");
export const WORLD_RULES_PATH = path.join(CANON_DIR, "world_rules.md");

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function readJsonFile<T>(p: string): T | null {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readMd(p: string): string {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Delta application (deep merge sub-objects without wiping unmentioned keys)
// ---------------------------------------------------------------------------

export function applyDelta(state: WorldState, delta: WorldStateDelta): WorldState {
  const next: WorldState = {
    ...state,
    world: { ...state.world, ...(delta.world ?? {}) },
    company_state: { ...state.company_state, ...(delta.company_state ?? {}) },
    product_state: { ...state.product_state, ...(delta.product_state ?? {}) },
    traction_state: {
      user_beta: {
        ...state.traction_state.user_beta,
        ...(delta.traction_state?.user_beta ?? {}),
      },
      merchant_pipeline: {
        ...state.traction_state.merchant_pipeline,
        ...(delta.traction_state?.merchant_pipeline ?? {}),
      },
      ecosystem_signal: {
        ...state.traction_state.ecosystem_signal,
        ...(delta.traction_state?.ecosystem_signal ?? {}),
      },
    },
    public_layer: { ...state.public_layer, ...(delta.public_layer ?? {}) },
    external_entities: { ...state.external_entities },
    character_states: { ...state.character_states },
    relationship_state: { ...state.relationship_state },
    open_tensions: [...state.open_tensions],
    active_events: [...state.active_events],
    pending_consequences: [...state.pending_consequences],
  };

  // External entities: merge per-key
  if (delta.external_entities) {
    for (const [id, patch] of Object.entries(delta.external_entities)) {
      const existing = next.external_entities[id];
      next.external_entities[id] = existing
        ? { ...existing, ...patch }
        : ({
            type: patch.type ?? "merchant",
            status: patch.status ?? "unknown",
            pressure: patch.pressure ?? "",
          } as typeof next.external_entities[string]);
    }
  }

  // Characters: merge per-character
  if (delta.character_states) {
    for (const [id, patch] of Object.entries(delta.character_states)) {
      const existing = next.character_states[id];
      if (existing) {
        next.character_states[id] = { ...existing, ...patch };
      }
    }
  }

  // Relationships: replace per-pair
  if (delta.relationship_state) {
    for (const [pair, value] of Object.entries(delta.relationship_state)) {
      next.relationship_state[pair] = value;
    }
  }

  // Tensions: add then remove
  if (delta.open_tensions_added) {
    for (const t of delta.open_tensions_added) {
      if (!next.open_tensions.includes(t)) next.open_tensions.push(t);
    }
  }
  if (delta.open_tensions_removed) {
    next.open_tensions = next.open_tensions.filter(
      (t) => !delta.open_tensions_removed!.includes(t),
    );
  }

  // Consequences: append
  if (delta.pending_consequences_added) {
    next.pending_consequences.push(...delta.pending_consequences_added);
  }

  return next;
}

// ---------------------------------------------------------------------------
// Cycle output enumeration
// ---------------------------------------------------------------------------

export function listCycleOutputFiles(): string[] {
  if (!fs.existsSync(CYCLES_DIR)) return [];
  return fs
    .readdirSync(CYCLES_DIR)
    .filter((f) => f.startsWith("cycle_") && f.endsWith("_output.json"))
    .sort();
}

export function loadCycleOutputs(): CycleOutput[] {
  return listCycleOutputFiles()
    .map((f) => readJsonFile<CycleOutput>(path.join(CYCLES_DIR, f)))
    .filter((x): x is CycleOutput => x !== null);
}

export function loadLatestCycleOutput(): CycleOutput | null {
  const cycles = loadCycleOutputs();
  return cycles.length > 0 ? cycles[cycles.length - 1] : null;
}

// ---------------------------------------------------------------------------
// World state loaders
// ---------------------------------------------------------------------------

export function loadInitialState(): WorldState | null {
  return readJsonFile<WorldState>(INITIAL_STATE_PATH);
}

export async function loadCurrentWorldState(): Promise<WorldState | null> {
  const cached = readJsonFile<WorldState>(CURRENT_STATE_PATH);
  if (cached) return cached;

  const seed = loadInitialState();
  if (!seed) return null;

  let state: WorldState = seed;
  for (const cycle of loadCycleOutputs()) {
    state = applyDelta(state, cycle.state_updates);
    state.world.day = cycle.day;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Timeline loader
// ---------------------------------------------------------------------------

export function loadTimeline(): TimelineEvent[] {
  return readJsonFile<TimelineEvent[]>(TIMELINE_PATH) ?? [];
}

// ---------------------------------------------------------------------------
// World log / Daybook loader
// ---------------------------------------------------------------------------

export function loadWorldLog(): WorldLogEntry[] {
  return readJsonFile<WorldLogEntry[]>(LOG_PATH) ?? [];
}

// ---------------------------------------------------------------------------
// Generation metadata loader (per-cycle: actual mode, model, duration, ...)
// ---------------------------------------------------------------------------

export function loadGenerationLog(): GenerationMetadata[] {
  return readJsonFile<GenerationMetadata[]>(GENERATION_LOG_PATH) ?? [];
}

export function loadLatestGeneration(): GenerationMetadata | null {
  const log = loadGenerationLog();
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

export function getLastUpdatedAt(): string | null {
  try {
    if (fs.existsSync(CURRENT_STATE_PATH)) {
      return fs.statSync(CURRENT_STATE_PATH).mtime.toISOString();
    }
    const files = listCycleOutputFiles();
    if (files.length > 0) {
      const latest = path.join(CYCLES_DIR, files[files.length - 1]);
      return fs.statSync(latest).mtime.toISOString();
    }
  } catch {
    // ignore
  }
  return null;
}
