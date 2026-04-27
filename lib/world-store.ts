import "server-only";
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import type {
  CycleOutput,
  GenerationMetadata,
  TimelineEvent,
  WorldLogEntry,
  WorldState,
} from "@/types/world";
import { applyDelta } from "@/lib/delta";

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
// Store contract
// ---------------------------------------------------------------------------

export interface WorldStore {
  loadCurrentWorldState(): Promise<WorldState | null>;
  writeCurrentWorldState(state: WorldState): Promise<void>;
  loadInitialState(): Promise<WorldState | null>;
  loadCycleOutputs(): Promise<CycleOutput[]>;
  loadLatestCycleOutput(): Promise<CycleOutput | null>;
  writeCycleOutput(cycle: CycleOutput): Promise<string>;
  loadTimeline(): Promise<TimelineEvent[]>;
  appendOrReplaceTimelineEvent(event: TimelineEvent): Promise<void>;
  loadWorldLog(): Promise<WorldLogEntry[]>;
  appendOrReplaceLogEntries(
    cycleId: string,
    entries: WorldLogEntry[],
  ): Promise<void>;
  loadGenerationLog(): Promise<GenerationMetadata[]>;
  appendOrReplaceGenerationMetadata(meta: GenerationMetadata): Promise<void>;
  resetMutableWorldState(): Promise<void>;
  getLastUpdatedAt(): Promise<string | null>;
}

type JsonRow<T> = { data: T | string };
type TimestampRow = { updated_at: Date | string | null };

function readJsonFile<T>(p: string): T | null {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(p: string, data: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function removeFileIfPresent(p: string): void {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore reset races / local filesystem hiccups
  }
}

function decodeJson<T>(value: T | string): T {
  return typeof value === "string" ? (JSON.parse(value) as T) : value;
}

function toIsoTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export class FileWorldStore implements WorldStore {
  listCycleOutputFiles(): string[] {
    if (!fs.existsSync(CYCLES_DIR)) return [];
    return fs
      .readdirSync(CYCLES_DIR)
      .filter((f) => f.startsWith("cycle_") && f.endsWith("_output.json"))
      .sort();
  }

  async loadCurrentWorldState(): Promise<WorldState | null> {
    const cached = readJsonFile<WorldState>(CURRENT_STATE_PATH);
    if (cached) return cached;

    const seed = await this.loadInitialState();
    if (!seed) return null;

    let state: WorldState = seed;
    for (const cycle of await this.loadCycleOutputs()) {
      state = applyDelta(state, cycle.state_updates);
      state.world.day = cycle.day;
    }
    return state;
  }

  async writeCurrentWorldState(state: WorldState): Promise<void> {
    writeJsonFile(CURRENT_STATE_PATH, state);
  }

  async loadInitialState(): Promise<WorldState | null> {
    return readJsonFile<WorldState>(INITIAL_STATE_PATH);
  }

  async loadCycleOutputs(): Promise<CycleOutput[]> {
    return this.listCycleOutputFiles()
      .map((f) => readJsonFile<CycleOutput>(path.join(CYCLES_DIR, f)))
      .filter((x): x is CycleOutput => x !== null);
  }

  async loadLatestCycleOutput(): Promise<CycleOutput | null> {
    const cycles = await this.loadCycleOutputs();
    return cycles.length > 0 ? cycles[cycles.length - 1] : null;
  }

  async writeCycleOutput(cycle: CycleOutput): Promise<string> {
    fs.mkdirSync(CYCLES_DIR, { recursive: true });
    const fileName = `${cycle.cycle_id}_output.json`;
    const fullPath = path.join(CYCLES_DIR, fileName);
    writeJsonFile(fullPath, cycle);
    return fullPath;
  }

  async loadTimeline(): Promise<TimelineEvent[]> {
    return readJsonFile<TimelineEvent[]>(TIMELINE_PATH) ?? [];
  }

  async appendOrReplaceTimelineEvent(event: TimelineEvent): Promise<void> {
    const existing = await this.loadTimeline();
    const filtered = existing.filter((e) => e.cycle_id !== event.cycle_id);
    const next = [...filtered, event].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.cycle_id.localeCompare(b.cycle_id);
    });
    writeJsonFile(TIMELINE_PATH, next);
  }

  async loadWorldLog(): Promise<WorldLogEntry[]> {
    return readJsonFile<WorldLogEntry[]>(LOG_PATH) ?? [];
  }

  async appendOrReplaceLogEntries(
    cycleId: string,
    entries: WorldLogEntry[],
  ): Promise<void> {
    const existing = await this.loadWorldLog();
    const filtered = existing.filter((e) => e.cycle_id !== cycleId);
    const next = [...filtered, ...entries].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.id.localeCompare(b.id);
    });
    writeJsonFile(LOG_PATH, next);
  }

  async loadGenerationLog(): Promise<GenerationMetadata[]> {
    return readJsonFile<GenerationMetadata[]>(GENERATION_LOG_PATH) ?? [];
  }

  async appendOrReplaceGenerationMetadata(
    meta: GenerationMetadata,
  ): Promise<void> {
    const existing = await this.loadGenerationLog();
    const filtered = existing.filter((m) => m.cycle_id !== meta.cycle_id);
    const next = [...filtered, meta].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.cycle_id.localeCompare(b.cycle_id);
    });
    writeJsonFile(GENERATION_LOG_PATH, next);
  }

  async resetMutableWorldState(): Promise<void> {
    removeFileIfPresent(CURRENT_STATE_PATH);
    removeFileIfPresent(TIMELINE_PATH);
    removeFileIfPresent(LOG_PATH);
    removeFileIfPresent(GENERATION_LOG_PATH);

    try {
      if (fs.existsSync(CYCLES_DIR)) {
        for (const entry of fs.readdirSync(CYCLES_DIR)) {
          if (entry.startsWith("cycle_") && entry.endsWith("_output.json")) {
            removeFileIfPresent(path.join(CYCLES_DIR, entry));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  async getLastUpdatedAt(): Promise<string | null> {
    try {
      if (fs.existsSync(CURRENT_STATE_PATH)) {
        return fs.statSync(CURRENT_STATE_PATH).mtime.toISOString();
      }
      const files = this.listCycleOutputFiles();
      if (files.length > 0) {
        const latest = path.join(CYCLES_DIR, files[files.length - 1]);
        return fs.statSync(latest).mtime.toISOString();
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export class PostgresWorldStore implements WorldStore {
  private readonly sql: ReturnType<typeof neon>;
  private schemaReady: Promise<void> | null = null;

  constructor(connectionString: string) {
    this.sql = neon(connectionString);
  }

  private async ensureSchema(): Promise<void> {
    this.schemaReady ??= this.createSchema();
    await this.schemaReady;
  }

  private async createSchema(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS world_state (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS cycle_outputs (
        cycle_id text PRIMARY KEY,
        day integer NOT NULL,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS timeline_events (
        cycle_id text PRIMARY KEY,
        day integer NOT NULL,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS world_log_entries (
        id text PRIMARY KEY,
        cycle_id text NOT NULL,
        day integer NOT NULL,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE TABLE IF NOT EXISTS generation_metadata (
        cycle_id text PRIMARY KEY,
        day integer NOT NULL,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    await this.sql`
      CREATE INDEX IF NOT EXISTS world_log_entries_cycle_id_idx
      ON world_log_entries (cycle_id)
    `;
  }

  async loadCurrentWorldState(): Promise<WorldState | null> {
    await this.ensureSchema();
    const rows = (await this.sql`
      SELECT data FROM world_state WHERE id = 'current' LIMIT 1
    `) as JsonRow<WorldState>[];
    if (rows[0]) return decodeJson(rows[0].data);

    const seed = await this.loadInitialState();
    if (!seed) return null;

    let state: WorldState = seed;
    for (const cycle of await this.loadCycleOutputs()) {
      state = applyDelta(state, cycle.state_updates);
      state.world.day = cycle.day;
    }
    return state;
  }

  async writeCurrentWorldState(state: WorldState): Promise<void> {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO world_state (id, data, updated_at)
      VALUES ('current', ${JSON.stringify(state)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE
      SET data = EXCLUDED.data,
          updated_at = now()
    `;
  }

  async loadInitialState(): Promise<WorldState | null> {
    return readJsonFile<WorldState>(INITIAL_STATE_PATH);
  }

  async loadCycleOutputs(): Promise<CycleOutput[]> {
    await this.ensureSchema();
    const rows = (await this.sql`
      SELECT data FROM cycle_outputs ORDER BY day ASC, cycle_id ASC
    `) as JsonRow<CycleOutput>[];
    return rows.map((row) => decodeJson(row.data));
  }

  async loadLatestCycleOutput(): Promise<CycleOutput | null> {
    await this.ensureSchema();
    const rows = (await this.sql`
      SELECT data FROM cycle_outputs ORDER BY day DESC, cycle_id DESC LIMIT 1
    `) as JsonRow<CycleOutput>[];
    return rows[0] ? decodeJson(rows[0].data) : null;
  }

  async writeCycleOutput(cycle: CycleOutput): Promise<string> {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO cycle_outputs (cycle_id, day, data, created_at, updated_at)
      VALUES (${cycle.cycle_id}, ${cycle.day}, ${JSON.stringify(cycle)}::jsonb, now(), now())
      ON CONFLICT (cycle_id) DO UPDATE
      SET day = EXCLUDED.day,
          data = EXCLUDED.data,
          updated_at = now()
    `;
    return `postgres://cycle_outputs/${cycle.cycle_id}`;
  }

  async loadTimeline(): Promise<TimelineEvent[]> {
    await this.ensureSchema();
    const rows = (await this.sql`
      SELECT data FROM timeline_events ORDER BY day ASC, cycle_id ASC
    `) as JsonRow<TimelineEvent>[];
    return rows.map((row) => decodeJson(row.data));
  }

  async appendOrReplaceTimelineEvent(event: TimelineEvent): Promise<void> {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO timeline_events (cycle_id, day, data, updated_at)
      VALUES (${event.cycle_id}, ${event.day}, ${JSON.stringify(event)}::jsonb, now())
      ON CONFLICT (cycle_id) DO UPDATE
      SET day = EXCLUDED.day,
          data = EXCLUDED.data,
          updated_at = now()
    `;
  }

  async loadWorldLog(): Promise<WorldLogEntry[]> {
    await this.ensureSchema();
    const rows = (await this.sql`
      SELECT data FROM world_log_entries ORDER BY day ASC, id ASC
    `) as JsonRow<WorldLogEntry>[];
    return rows.map((row) => decodeJson(row.data));
  }

  async appendOrReplaceLogEntries(
    cycleId: string,
    entries: WorldLogEntry[],
  ): Promise<void> {
    await this.ensureSchema();
    await this.sql.transaction((txn) => [
      txn`DELETE FROM world_log_entries WHERE cycle_id = ${cycleId}`,
      ...entries.map(
        (entry) => txn`
          INSERT INTO world_log_entries (id, cycle_id, day, data, updated_at)
          VALUES (${entry.id}, ${entry.cycle_id}, ${entry.day}, ${JSON.stringify(entry)}::jsonb, now())
          ON CONFLICT (id) DO UPDATE
          SET cycle_id = EXCLUDED.cycle_id,
              day = EXCLUDED.day,
              data = EXCLUDED.data,
              updated_at = now()
        `,
      ),
    ]);
  }

  async loadGenerationLog(): Promise<GenerationMetadata[]> {
    await this.ensureSchema();
    const rows = (await this.sql`
      SELECT data FROM generation_metadata ORDER BY day ASC, cycle_id ASC
    `) as JsonRow<GenerationMetadata>[];
    return rows.map((row) => decodeJson(row.data));
  }

  async appendOrReplaceGenerationMetadata(
    meta: GenerationMetadata,
  ): Promise<void> {
    await this.ensureSchema();
    await this.sql`
      INSERT INTO generation_metadata (cycle_id, day, data, updated_at)
      VALUES (${meta.cycle_id}, ${meta.day}, ${JSON.stringify(meta)}::jsonb, now())
      ON CONFLICT (cycle_id) DO UPDATE
      SET day = EXCLUDED.day,
          data = EXCLUDED.data,
          updated_at = now()
    `;
  }

  async resetMutableWorldState(): Promise<void> {
    await this.ensureSchema();
    await this.sql.transaction((txn) => [
      txn`DELETE FROM world_log_entries`,
      txn`DELETE FROM generation_metadata`,
      txn`DELETE FROM timeline_events`,
      txn`DELETE FROM cycle_outputs`,
      txn`DELETE FROM world_state`,
    ]);
  }

  async getLastUpdatedAt(): Promise<string | null> {
    await this.ensureSchema();
    const rows = (await this.sql`
      SELECT max(updated_at) AS updated_at
      FROM (
        SELECT updated_at FROM world_state
        UNION ALL SELECT updated_at FROM cycle_outputs
        UNION ALL SELECT updated_at FROM timeline_events
        UNION ALL SELECT updated_at FROM world_log_entries
        UNION ALL SELECT updated_at FROM generation_metadata
      ) updates
    `) as TimestampRow[];
    return toIsoTimestamp(rows[0]?.updated_at);
  }
}

let worldStore: WorldStore | null = null;

function createWorldStore(): WorldStore {
  const storeKind = (process.env.TALLEA_WORLD_STORE ?? "file").toLowerCase();
  if (storeKind === "file" || storeKind === "filesystem") {
    return new FileWorldStore();
  }

  if (storeKind === "postgres") {
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        "TALLEA_WORLD_STORE=postgres requires DATABASE_URL or POSTGRES_URL. Add a Neon Postgres integration in Vercel Marketplace, or unset TALLEA_WORLD_STORE to use local JSON files.",
      );
    }
    return new PostgresWorldStore(connectionString);
  }

  throw new Error(
    `Unsupported TALLEA_WORLD_STORE="${storeKind}". Use "file" or "postgres".`,
  );
}

export function getWorldStore(): WorldStore {
  worldStore ??= createWorldStore();
  return worldStore;
}
