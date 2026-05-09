"use client";

import { ErrorBlock } from "@/components/ui/feedback";
import { dbErrorMessage } from "@/lib/dbErrors";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = dbErrorMessage(error, error.message || "Failed to load projects");
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">Projects</h1>
      <div className="mt-8">
        <ErrorBlock message={message} onRetry={reset} />
      </div>
    </main>
  );
}
