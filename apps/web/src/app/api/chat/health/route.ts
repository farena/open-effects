import { NextResponse } from "next/server";
import { isClaudeAvailable } from "@/lib/claude-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ claudeAvailable: isClaudeAvailable() });
}
