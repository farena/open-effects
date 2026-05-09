import Link from "next/link";
import { db } from "@/lib/db";
import { dbErrorMessage } from "@/lib/dbErrors";
import { Card } from "@/components/ui/card";
import { ErrorBlock } from "@/components/ui/feedback";
import { NewProjectDialog } from "./_components/NewProjectDialog";
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
      <main className="container mx-auto p-8">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="mt-8">
          <ErrorBlock message={message} />
        </div>
      </main>
    );
  }
  return (
    <main className="container mx-auto p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/business-context"
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Business context
          </Link>
          <NewProjectDialog />
        </div>
      </header>
      {projects.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center gap-3 p-12 text-center">
          <p className="text-base font-medium">No projects yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Projects hold scenes, layers, audio, and keyframes. Use the button
            above to create your first one.
          </p>
        </Card>
      ) : (
        <ul className="mt-8 grid grid-cols-3 gap-4">
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
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/" className="underline">
          ← Home
        </Link>
      </p>
    </main>
  );
}
