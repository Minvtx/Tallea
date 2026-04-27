import { start } from "workflow/api";
import {
  runWorldCycleWorkflow,
  type WorldCycleWorkflowSummary,
} from "@/app/workflows/run-world-cycle-workflow";
import { runWorldCycle, type RunCycleResult } from "@/lib/orchestrator";

export type CycleRunnerKind = "direct" | "workflow";

export interface DirectCycleRun {
  runner: "direct";
  result: RunCycleResult;
}

export interface WorkflowCycleRun {
  runner: "workflow";
  runId: string;
  message: string;
}

export type CycleRunDispatch = DirectCycleRun | WorkflowCycleRun;

export function getCycleRunnerKind(): CycleRunnerKind {
  const runner = (process.env.TALLEA_CYCLE_RUNNER ?? "direct").toLowerCase();
  if (runner === "direct" || runner === "workflow") return runner;
  throw new Error(
    `Unsupported TALLEA_CYCLE_RUNNER="${runner}". Use "direct" or "workflow".`,
  );
}

export async function startWorldCycleWorkflowRun(): Promise<WorkflowCycleRun> {
  const run = await start<WorldCycleWorkflowSummary>(runWorldCycleWorkflow);
  return {
    runner: "workflow",
    runId: run.runId,
    message:
      "World cycle workflow started. Refresh the admin pages after it completes.",
  };
}

export async function runConfiguredWorldCycle(): Promise<CycleRunDispatch> {
  const runner = getCycleRunnerKind();
  if (runner === "workflow") {
    return startWorldCycleWorkflowRun();
  }

  return {
    runner: "direct",
    result: await runWorldCycle(),
  };
}
