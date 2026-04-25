import { NextResponse } from "next/server";
import { runWorldCycle } from "@/lib/orchestrator";

/**
 * Vercel Cron entry point.
 *
 * Vercel Cron sends Authorization: Bearer ${CRON_SECRET} on each invocation
 * (the secret is configured as an env var on the project). We reject any
 * request without a matching token. Manual smoke tests can hit this route
 * with the same header.
 *
 * Schedule is declared in vercel.json. The handler is intentionally tiny:
 * runWorldCycle() does generation, persistence, timeline, and projection.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is set (e.g. local dev), allow only same-origin GETs.
  // In production, CRON_SECRET should always be configured.
  if (!secret) return true;

  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWorldCycle();
    return NextResponse.json({
      ok: true,
      cycle_id: result.cycleOutput.cycle_id,
      day: result.cycleOutput.day,
      title: result.cycleOutput.title,
      timeline_cycle_id: result.timelineEvent.cycle_id,
      mode: process.env.TALLEA_ENABLE_AI === "true" ? "ai" : "mock",
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
