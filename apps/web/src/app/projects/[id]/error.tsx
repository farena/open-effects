"use client";

import Link from "next/link";
import { ErrorBlock } from "@/components/ui/feedback";
import { dbErrorMessage } from "@/lib/dbErrors";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const message = dbErrorMessage(error, error.message || "Failed to load project");
  return (
    <main className="container mx-auto p-8">
      <ErrorBlock message={message} onRetry={reset} />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/projects" className="underline">
          ← Back to projects
        </Link>
      </p>
    </main>
  );
}
