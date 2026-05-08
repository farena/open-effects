import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Serves the OpenAPI 3.1 specification at /api/openapi.yaml.
//
// The file is resolved relative to process.cwd(), which equals the apps/web
// directory when running `next dev` or `next start` from apps/web.
// If a future deployment changes the working directory, switch to
// import.meta.url-based resolution instead.

export async function GET() {
  const file = path.resolve(process.cwd(), "openapi.yaml");
  const yaml = await readFile(file, "utf8");
  return new NextResponse(yaml, {
    status: 200,
    headers: { "content-type": "application/yaml; charset=utf-8" },
  });
}
