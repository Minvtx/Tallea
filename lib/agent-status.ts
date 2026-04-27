import {
  getLastUpdatedAt,
  listCycleOutputFiles,
  loadCurrentWorldState,
  loadLatestCycleOutput,
  loadLatestGeneration,
  loadTimeline,
  loadWorldLog,
} from "@/lib/loaders";
import { getCycleRunnerKind } from "@/lib/cycle-runner";
import { getCycleModeStatus } from "@/lib/orchestrator";

export interface PublicAgentStatus {
  world: {
    day: number;
    phase: string | null;
  };
  counts: {
    cycles: number;
    timeline: number;
    daybook: number;
  };
  last_updated_at: string | null;
  store: "file" | "postgres";
  runner: "direct" | "workflow";
  ai: {
    mode: "mock" | "ai";
    provider: "gateway" | "openai" | "mock";
    model: string;
  };
  last_generation: {
    actual_mode: "ai" | "mock" | "fallback_to_mock";
    provider?: "gateway" | "openai" | "mock";
    model?: string;
    duration_ms: number;
    fallback_reason?: string;
  } | null;
  latest_cycle: {
    cycle_id: string;
    day: number;
    title: string;
    trigger: string;
    outcome: string;
    residue: string;
    primary_pressure: string;
  } | null;
}

export function getWorldStoreKind(): "file" | "postgres" {
  const raw = (process.env.TALLEA_WORLD_STORE ?? "file").toLowerCase();
  return raw === "postgres" ? "postgres" : "file";
}

export async function getPublicAgentStatus(): Promise<PublicAgentStatus> {
  const [
    world,
    latestCycle,
    cycleFiles,
    timeline,
    worldLog,
    lastUpdatedAt,
    lastGen,
  ] = await Promise.all([
    loadCurrentWorldState(),
    loadLatestCycleOutput(),
    listCycleOutputFiles(),
    loadTimeline(),
    loadWorldLog(),
    getLastUpdatedAt(),
    loadLatestGeneration(),
  ]);
  const modeStatus = getCycleModeStatus();

  return {
    world: {
      day: world?.world.day ?? 0,
      phase: world?.world.phase ?? null,
    },
    counts: {
      cycles: cycleFiles.length,
      timeline: timeline.length,
      daybook: worldLog.length,
    },
    last_updated_at: lastUpdatedAt,
    store: getWorldStoreKind(),
    runner: getCycleRunnerKind(),
    ai: {
      mode: modeStatus.mode,
      provider: modeStatus.provider,
      model: modeStatus.model,
    },
    last_generation: lastGen
      ? {
          actual_mode: lastGen.actual_mode,
          provider: lastGen.provider,
          model: lastGen.model,
          duration_ms: lastGen.duration_ms,
          fallback_reason: lastGen.fallback_reason,
        }
      : null,
    latest_cycle: latestCycle
      ? {
          cycle_id: latestCycle.cycle_id,
          day: latestCycle.day,
          title: latestCycle.title,
          trigger: latestCycle.trigger,
          outcome: latestCycle.outcome,
          residue: latestCycle.residue,
          primary_pressure: latestCycle.primary_pressure,
        }
      : null,
  };
}
