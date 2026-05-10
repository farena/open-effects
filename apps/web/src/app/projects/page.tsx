import Link from "next/link";
import { db } from "@/lib/db";
import { dbErrorMessage } from "@/lib/dbErrors";
import { Card } from "@/components/ui/card";
import { ErrorBlock } from "@/components/ui/feedback";
import { ProjectsTopBar } from "./_components/ProjectsTopBar";
import { DeleteProjectButton } from "./_components/DeleteProjectButton";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  let projects;
  try {
    projects = await db.project.findMany({
      orderBy: { updatedAt: "desc" },
    });
  } catch (err) {
    const message = dbErrorMessage(err, "Failed to load projects");
    return (
      <div className="h-screen max-h-screen flex flex-col overflow-hidden bg-background">
        <ProjectsTopBar />
        <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          <ErrorBlock message={message} />
        </main>
      </div>
    );
  }
  return (
    <div className="h-screen max-h-screen flex flex-col overflow-hidden bg-background">
      <ProjectsTopBar />
      <main className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {projects.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-base font-medium">No projects yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Projects hold scenes, layers, audio, and keyframes. Use the button
              above to create your first one.
            </p>
          </Card>
        ) : (
          <ul className="grid grid-cols-3 gap-4">
            {projects.map((p) => (
              <li key={p.id}>
                <Card className="p-4 flex items-center justify-between gap-2">
                  <Link
                    href={`/projects/${p.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <DeleteProjectButton projectId={p.id} projectName={p.name} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
