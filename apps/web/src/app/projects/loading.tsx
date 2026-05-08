import { LoadingSkeleton } from "@/components/ui/feedback";

export default function ProjectsLoading() {
  return (
    <main className="container mx-auto p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
      </header>
      <div className="mt-8">
        <LoadingSkeleton rows={6} rowClassName="h-16" />
      </div>
    </main>
  );
}
