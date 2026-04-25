"use client";

import { useFormStatus } from "react-dom";
import {
  resetWorldAction,
  runCycleAction,
  runThreeCyclesAction,
} from "@/app/admin/actions";

function PrimaryButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] bg-foreground text-background hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
    >
      {pending ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-background animate-pulse-dot" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function GhostButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] border hairline text-foreground hover:border-foreground/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse-dot" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function DangerButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[13px] text-muted hover:text-foreground disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      onClick={(e) => {
        if (
          !confirm(
            "Reset the world back to seed? Cycles, current state, and timeline will be deleted. Canon and seed are untouched.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      {pending ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse-dot" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

export function AdminActionsPanel() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={runCycleAction}>
        <PrimaryButton label="Run next cycle" pendingLabel="Running…" />
      </form>
      <form action={runThreeCyclesAction}>
        <GhostButton label="Run 3 cycles" pendingLabel="Running 3…" />
      </form>
      <form action={resetWorldAction}>
        <DangerButton label="Reset to seed" pendingLabel="Resetting…" />
      </form>
    </div>
  );
}
