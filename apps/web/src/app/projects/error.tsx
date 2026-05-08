"use client";

import { ErrorBlock } from "@/components/ui/feedback";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">Projects</h1>
      <div className="mt-8">
        <ErrorBlock
          message={error.message || "Failed to load projects"}
          onRetry={reset}
        />
      </div>
    </main>
  );
}
