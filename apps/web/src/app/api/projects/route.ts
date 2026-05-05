import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json(projects);
}
