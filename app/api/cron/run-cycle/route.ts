import { NextResponse } from "next/server";
import { runConfiguredWorldCycle } from "@/lib/cycle-runner";

/**
 * Vercel Cron entry point.
 *
 * Vercel Cron sends Authorization: Bearer ${CRON_SECRET} on each invocation
 * (the secret is configured as an env var on the project). We reject any
 * request without a matching token. Manual smoke tests can hit this route
 * with the same header.
 *
 * Schedule is declared in vercel.json. The handler is intentionally tiny:
 * direct mode runs one cycle inline; workflow mode queues a durable workflow.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCronAuthFailure(req: Request): { message: string; status: number } | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      return {
        message: "CRON_SECRET is required in production.",
        status: 500,
      };
    }
    return null;
  }

  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return { message: "unauthorized", status: 401 };
  }

  return null;
}

export async function GET(req: Request) {
  const authFailure = getCronAuthFailure(req);
  if (authFailure) {
    return NextResponse.json(
      { ok: false, error: authFailure.message },
      { status: authFailure.status },
    );
  }

  try {
    const dispatch = await runConfiguredWorldCycle();
    if (dispatch.runner === "workflow") {
      return NextResponse.json({
        ok: true,
        runner: "workflow",
        workflow_run_id: dispatch.runId,
        message: dispatch.message,
      });
    }

    const result = dispatch.result;
    const g = result.generation;
    return NextResponse.json({
      ok: true,
      runner: "direct",
      cycle_id: result.cycleOutput.cycle_id,
      day: result.cycleOutput.day,
      title: result.cycleOutput.title,
      timeline_cycle_id: result.timelineEvent.cycle_id,
      log_entries: result.logEntries.length,
      // Observability: actual generation path, not env-derived assumption.
      generation: {
        actual_mode: g.actual_mode,
        env_mode: g.env_mode,
        provider: g.provider,
        model: g.model,
        temperature: g.temperature,
        duration_ms: g.duration_ms,
        fallback_reason: g.fallback_reason,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}

// Allow POST too — some platforms only support POST hooks.
export const POST = GET;
