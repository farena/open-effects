import { NextResponse } from "next/server";
import { renderRegistry } from "@/lib/render/renderRegistry";
import { runRenderJob } from "@/lib/render/renderJob";
import { db } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  const job = renderRegistry.create(projectId);
  // Fire-and-forget; SSE stream conveys progress
  runRenderJob(job.id, projectId).catch(() => {
    /* state already updated by registry */
  });
  return NextResponse.json({ renderId: job.id }, { status: 202 });
}
