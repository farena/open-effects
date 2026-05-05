import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { NewProjectDialog } from "./_components/NewProjectDialog";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <main className="container mx-auto p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <NewProjectDialog />
      </header>
      {projects.length === 0 ? (
        <Card className="mt-8 p-12 text-center text-muted-foreground">
          No projects yet. Stage 3 will enable creation.
        </Card>
      ) : (
        <ul className="mt-8 grid grid-cols-3 gap-4">
          {projects.map((p) => (
            <li key={p.id}><Card className="p-4">{p.name}</Card></li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/" className="underline">← Home</Link>
      </p>
    </main>
  );
}
