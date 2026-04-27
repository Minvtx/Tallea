import { NextResponse } from "next/server";
import { getPublicAgentStatus } from "@/lib/agent-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getPublicAgentStatus();
  return NextResponse.json(status);
}
