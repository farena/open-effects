"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Asset {
  id: string;
  filename: string;
  type: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

export function UploadButton({
  onUploaded,
}: {
  onUploaded: (asset: Asset) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        ref={ref}
        type="file"
        hidden
        accept="image/*,audio/*,video/*,font/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          const fd = new FormData();
          fd.append("file", file);
          try {
            const res = await fetch("/api/assets", {
              method: "POST",
              body: fd,
            });
            if (!res.ok) throw new Error(await res.text());
            const asset = await res.json();
            toast.success(`Uploaded ${asset.filename}`);
            onUploaded(asset);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            toast.error("Upload failed", { description: message });
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <Button size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? "Uploading…" : "+ Upload"}
      </Button>
    </>
  );
}
