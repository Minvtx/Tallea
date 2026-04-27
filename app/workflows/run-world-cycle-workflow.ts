import type { GenerationMetadata } from "@/types/world";
import {
  buildCycleContext,
  generateCycleOutput,
  persistGeneratedCycle,
  type CycleContext,
  type GenerateResult,
} from "@/lib/orchestrator";
import { loadCurrentWorldState, loadInitialState } from "@/lib/loaders";

export interface WorldCycleWorkflowSummary {
  cycle_id: string;
  day: number;
  title: string;
  generation: Pick<
    GenerationMetadata,
    | "actual_mode"
    | "env_mode"
    | "provider"
    | "model"
    | "duration_ms"
    | "fallback_reason"
  >;
  log_entries: number;
}

export async function loadWorldCycleContextStep(): Promise<CycleContext> {
  "use step";

  let state = await loadCurrentWorldState();
  if (!state) {
    state = await loadInitialState();
    if (!state) {
      throw new Error("No initial state found at data/seed/initial_state.json");
    }
  }

  return buildCycleContext(state);
}

export async function generateCycleOutputStep(
  ctx: CycleContext,
): Promise<GenerateResult> {
  "use step";

  return generateCycleOutput(ctx);
}

export async function persistWorldCycleStep(
  ctx: CycleContext,
  generated: GenerateResult,
): Promise<WorldCycleWorkflowSummary> {
  "use step";

  const result = await persistGeneratedCycle(ctx.state, generated);
  const g = result.generation;

  return {
    cycle_id: result.cycleOutput.cycle_id,
    day: result.cycleOutput.day,
    title: result.cycleOutput.title,
    generation: {
      actual_mode: g.actual_mode,
      env_mode: g.env_mode,
      provider: g.provider,
      model: g.model,
      duration_ms: g.duration_ms,
      fallback_reason: g.fallback_reason,
    },
    log_entries: result.logEntries.length,
  };
}

export async function runWorldCycleWorkflow(): Promise<WorldCycleWorkflowSummary> {
  "use workflow";

  const ctx = await loadWorldCycleContextStep();
  const generated = await generateCycleOutputStep(ctx);
  return persistWorldCycleStep(ctx, generated);
}
