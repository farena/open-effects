"use client";

import Link from "next/link";
import { ErrorBlock } from "@/components/ui/feedback";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container mx-auto p-8">
      <ErrorBlock
        message={error.message || "Failed to load project"}
        onRetry={reset}
      />
      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/projects" className="underline">
          ← Back to projects
        </Link>
      </p>
    </main>
  );
}
