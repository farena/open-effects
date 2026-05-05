import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const COMPONENTS_DIR = path.resolve(process.cwd(), "public/components");

/**
 * If `preview` is a data URL (data:image/png;base64,...), decode it,
 * write to public/components/<componentId>.png, and return the public URL.
 * If `preview` is empty/null/non-data-URL, return it unchanged (or null).
 */
export async function saveThumbnail(
  componentId: string,
  preview: string | null | undefined,
): Promise<string | null> {
  if (!preview) return null;
  const m = /^data:image\/png;base64,(.+)$/.exec(preview);
  if (!m) return preview; // already a URL — keep as-is
  const buf = Buffer.from(m[1]!, "base64");
  await mkdir(COMPONENTS_DIR, { recursive: true });
  const filename = `${componentId}.png`;
  await writeFile(path.join(COMPONENTS_DIR, filename), buf);
  return `/components/${filename}`;
}
