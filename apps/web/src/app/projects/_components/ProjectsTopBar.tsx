import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProjectDialog } from "./NewProjectDialog";

export function ProjectsTopBar() {
  return (
    <div className="px-6 py-4 border-b border-border bg-background flex items-center shrink-0">
      <div className="me-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/" aria-label="Back to home" title="Back to home">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-lg font-bold">Projects</h1>
        <p className="text-xs text-muted-foreground">
          Manage your videos, scenes, layers, and audio.
        </p>
      </div>
      <div className="flex items-center gap-2 ms-auto">
        <NewProjectDialog />
      </div>
    </div>
  );
}
