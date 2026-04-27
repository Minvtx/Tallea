"use server";

import { revalidatePath } from "next/cache";
import {
  getCycleRunnerKind,
  runConfiguredWorldCycle,
  startWorldCycleWorkflowRun,
} from "@/lib/cycle-runner";
import { resetWorldState } from "@/lib/state";
import { requireAdminAccess } from "@/lib/admin-auth";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/pulse");
  revalidatePath("/timeline");
  revalidatePath("/daybook");
  revalidatePath("/admin");
}

export async function runCycleAction(): Promise<void> {
  await requireAdminAccess();
  await runConfiguredWorldCycle();
  revalidateAll();
}

export async function runThreeCyclesAction(): Promise<void> {
  await requireAdminAccess();
  if (getCycleRunnerKind() === "workflow") {
    await startWorldCycleWorkflowRun();
    revalidateAll();
    return;
  }

  for (let i = 0; i < 3; i++) {
    await runConfiguredWorldCycle();
  }
  revalidateAll();
}

export async function resetWorldAction(): Promise<void> {
  await requireAdminAccess();
  await resetWorldState();
  revalidateAll();
}
