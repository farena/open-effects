import path from "node:path";
import { mkdir } from "node:fs/promises";

export async function ensureOutputDir(
  projectId: string,
): Promise<{ absDir: string; publicDir: string }> {
  const publicDir = `/renders/${projectId}`;
  const absDir = path.resolve(process.cwd(), "public/renders", projectId);
  await mkdir(absDir, { recursive: true });
  return { absDir, publicDir };
}

export function timestampedFilename(): string {
  const t = new Date().toISOString().replace(/[:.]/g, "-");
  return `${t}.mp4`;
}
