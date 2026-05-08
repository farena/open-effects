"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteRenderButton({
  projectId,
  filename,
}: {
  projectId: string;
  filename: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/renders/${filename}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      toast.success("Render deleted");
      router.refresh();
    } catch {
      toast.error("Delete failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      className="text-destructive hover:text-destructive"
      aria-label="Delete render"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
