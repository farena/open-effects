import Link from "next/link";
import { notFound } from "next/navigation";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { DeleteRenderButton } from "./_components/DeleteRenderButton";

type RenderEntry = {
  filename: string;
  mtime: Date;
  size: number;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function listRenders(projectId: string): Promise<RenderEntry[]> {
  const dir = resolve(process.cwd(), "public", "renders", projectId);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    names
      .filter((n) => n.endsWith(".mp4"))
      .map(async (filename) => {
        const s = await stat(join(dir, filename));
        return { filename, mtime: s.mtime, size: s.size };
      }),
  );
  return entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export const dynamic = "force-dynamic";

export default async function RendersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!project) notFound();

  const renders = await listRenders(id);

  return (
    <main className="container mx-auto p-8">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href={`/projects/${id}`}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            ← {project.name}
          </Link>
          <h1 className="text-2xl font-bold">Renders</h1>
        </div>
      </header>

      {renders.length === 0 ? (
        <Card className="mt-8 p-12 text-center text-muted-foreground">
          No renders yet. Use the Render button in the editor to export an MP4.
        </Card>
      ) : (
        <ul className="mt-8 flex flex-col gap-2">
          {renders.map((r) => (
            <li key={r.filename}>
              <Card className="flex items-center justify-between gap-4 p-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-mono text-sm truncate">
                    {r.filename}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {r.mtime.toLocaleString()} · {formatSize(r.size)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`/renders/${id}/${r.filename}`}
                    download
                    className="rounded border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    Download
                  </a>
                  <DeleteRenderButton projectId={id} filename={r.filename} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
