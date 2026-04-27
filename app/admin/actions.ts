"use server";

import { revalidatePath } from "next/cache";
import { runWorldCycle } from "@/lib/orchestrator";
import { resetWorldState } from "@/lib/state";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/pulse");
  revalidatePath("/timeline");
  revalidatePath("/daybook");
  revalidatePath("/admin");
}

export async function runCycleAction(): Promise<void> {
  await runWorldCycle();
  revalidateAll();
}

export async function runThreeCyclesAction(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await runWorldCycle();
  }
  revalidateAll();
}

export async function resetWorldAction(): Promise<void> {
  resetWorldState();
  revalidateAll();
}
