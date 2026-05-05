"use client";

import { useEffect, useState } from "react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditorStore } from "@/editor/store";
import { selectActiveScene } from "@/editor/selectors";
import { normalizePayload } from "@/lib/components/normalizePayload";

interface SaveComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function SaveComponentDialog({
  open,
  onOpenChange,
  onSaved,
}: SaveComponentDialogProps) {
  const activeScene = useEditorStore(selectActiveScene);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [checkedLayerIds, setCheckedLayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [busy, setBusy] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setCategory("");
      setCheckedLayerIds(
        selectedLayerId ? new Set([selectedLayerId]) : new Set(),
      );
      setBusy(false);
    }
  }, [open, selectedLayerId]);

  function toggleLayer(id: string) {
    setCheckedLayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!activeScene) return;
    const trimmedName = name.trim();
    if (!trimmedName || checkedLayerIds.size === 0 || busy) return;

    setBusy(true);
    try {
      const selectedLayers = activeScene.layers.filter((l) =>
        checkedLayerIds.has(l.id),
      );
      const { layers } = normalizePayload(selectedLayers);

      // Optional thumbnail capture — fail gracefully if cross-origin / no element
      let preview: string | null = null;
      const playerEl =
        document.querySelector<HTMLElement>("[data-remotion-canvas]") ??
        document.querySelector<HTMLElement>(".__remotion-player") ??
        null;
      if (playerEl) {
        try {
          const canvas = await html2canvas(playerEl, {
            useCORS: true,
            scale: 0.4,
            logging: false,
          });
          preview = canvas.toDataURL("image/png");
        } catch {
          // capture failed (cross-origin iframe etc.) — degrade gracefully
          preview = null;
        }
      }

      const body = {
        name: trimmedName,
        category: category.trim() || null,
        preview,
        payload: { layers },
      };
      const res = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      toast.success(`Saved component "${trimmedName}"`);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Save failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const sortedLayers = activeScene
    ? [...activeScene.layers].sort((a, b) => a.order - b.order)
    : [];

  const canSave = name.trim() !== "" && checkedLayerIds.size > 0 && !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save as component</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-name">Name *</Label>
            <Input
              id="sc-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Component name"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sc-category">Category</Label>
            <Input
              id="sc-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Optional category"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Layers</Label>
            <div className="max-h-48 overflow-y-auto rounded-md border p-2">
              {sortedLayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No layers in scene.
                </p>
              ) : (
                sortedLayers.map((layer) => (
                  <label
                    key={layer.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border accent-primary"
                      checked={checkedLayerIds.has(layer.id)}
                      onChange={() => toggleLayer(layer.id)}
                    />
                    <span className="text-sm">{layer.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
