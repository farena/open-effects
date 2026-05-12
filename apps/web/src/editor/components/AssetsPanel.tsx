"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Music,
  ImageIcon,
  Video,
  Type,
  Upload,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { UploadButton } from "./UploadButton";
import { ConfirmDialog } from "./ConfirmDialog";
import { LoadingSkeleton, ErrorBlock } from "@/components/ui/feedback";
import { EmptyState } from "./EmptyState";
import { useEditorStore } from "@/editor/store";

interface Asset {
  id: string;
  filename: string;
  type: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: string;
}

type FilterType = "all" | "image" | "audio" | "video" | "font";

type Phase =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; assets: Asset[] };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetIcon({ type }: { type: string }) {
  if (type === "audio") return <Music className="h-4 w-4 shrink-0" />;
  if (type === "image") return <ImageIcon className="h-4 w-4 shrink-0" />;
  if (type === "video") return <Video className="h-4 w-4 shrink-0" />;
  if (type === "font") return <Type className="h-4 w-4 shrink-0" />;
  return null;
}

export function AssetsPanel() {
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [filter, setFilter] = useState<FilterType>("all");
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<Asset | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const previewedAsset = useEditorStore((s) => s.previewedAsset);
  const setPreviewedAsset = useEditorStore((s) => s.setPreviewedAsset);

  const load = useCallback(() => {
    setPhase({ status: "loading" });
    fetch("/api/assets")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Asset[]) => setPhase({ status: "ready", assets: data }))
      .catch((e: unknown) =>
        setPhase({
          status: "error",
          error: e instanceof Error ? e.message : "Failed to load assets",
        }),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  function addAsset(asset: Asset) {
    setPhase((p) =>
      p.status === "ready"
        ? { status: "ready", assets: [asset, ...p.assets] }
        : { status: "ready", assets: [asset] },
    );
  }

  function applyAssetUpdate(updated: Asset) {
    setPhase((p) =>
      p.status === "ready"
        ? {
            status: "ready",
            assets: p.assets.map((a) => (a.id === updated.id ? updated : a)),
          }
        : p,
    );
    if (previewedAsset && previewedAsset.id === updated.id) {
      setPreviewedAsset({
        id: updated.id,
        path: updated.path,
        filename: updated.filename,
        mimeType: updated.mimeType,
        type: updated.type,
      });
    }
  }

  function removeAssetLocal(id: string) {
    setPhase((p) =>
      p.status === "ready"
        ? { status: "ready", assets: p.assets.filter((a) => a.id !== id) }
        : p,
    );
    if (previewedAsset && previewedAsset.id === id) setPreviewedAsset(null);
  }

  async function commitRename(id: string, value: string) {
    const trimmed = value.trim();
    setRenaming(null);
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated: Asset = await res.json();
      applyAssetUpdate(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Rename failed", { description: message });
    }
  }

  async function performDelete(asset: Asset) {
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        const refs = typeof body?.refs === "number" ? body.refs : undefined;
        toast.error("Cannot delete asset", {
          description:
            refs != null
              ? `Asset is referenced by ${refs} audio track${refs === 1 ? "" : "s"}.`
              : "Asset is in use.",
        });
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      removeAssetLocal(asset.id);
      toast.success("Deleted");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Delete failed", { description: message });
    }
  }

  function handleSelect(asset: Asset) {
    if (renaming?.id === asset.id) return;
    setPreviewedAsset({
      id: asset.id,
      path: asset.path,
      filename: asset.filename,
      mimeType: asset.mimeType,
      type: asset.type,
    });
  }

  const assets = phase.status === "ready" ? phase.assets : [];
  const visible =
    filter === "all" ? assets : assets.filter((a) => a.type === filter);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1.5 border-b">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Assets
        </span>
        <UploadButton onUploaded={addAsset} />
      </div>

      <div className="px-2 py-1.5 border-b">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
        >
          <option value="all">All</option>
          <option value="image">Images</option>
          <option value="audio">Audio</option>
          <option value="video">Video</option>
          <option value="font">Fonts</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-1 space-y-1">
        {phase.status === "loading" && <LoadingSkeleton rows={4} />}
        {phase.status === "error" && (
          <div className="p-2">
            <ErrorBlock message={phase.error} onRetry={load} />
          </div>
        )}
        {phase.status === "ready" && visible.length === 0 ? (
          <EmptyState
            icon={Upload}
            title={
              filter === "all"
                ? "No assets uploaded"
                : `No ${filter} assets uploaded`
            }
            description="Upload audio, images, video, or fonts to use them in your scenes."
          />
        ) : (
          phase.status === "ready" &&
          visible.map((asset) => {
            const draggable =
              asset.type === "audio" ||
              asset.type === "image" ||
              asset.type === "video";
            const isPreviewed = previewedAsset?.id === asset.id;
            const isRenaming = renaming?.id === asset.id;
            return (
              <div
                key={asset.id}
                data-testid="asset-row"
                draggable={draggable && !isRenaming}
                onDragStart={
                  draggable
                    ? (e) => {
                        e.dataTransfer.setData(
                          "application/x-asset",
                          JSON.stringify({
                            id: asset.id,
                            path: asset.path,
                            type: asset.type,
                            filename: asset.filename,
                            mimeType: asset.mimeType,
                          }),
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }
                    : undefined
                }
                onClick={() => handleSelect(asset)}
                onKeyDown={(e) => {
                  if (isRenaming) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(asset);
                  }
                }}
                role="button"
                tabIndex={0}
                className={[
                  "group flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                  draggable && !isRenaming
                    ? "cursor-grab active:cursor-grabbing"
                    : "cursor-pointer",
                  isPreviewed ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                ]
                  .join(" ")
                  .trim()}
              >
                <AssetIcon type={asset.type} />
                {isRenaming ? (
                  <input
                    ref={renameInputRef}
                    value={renaming!.value}
                    onChange={(e) =>
                      setRenaming({ id: asset.id, value: e.target.value })
                    }
                    onBlur={() => commitRename(asset.id, renaming!.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitRename(asset.id, renaming!.value);
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setRenaming(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 rounded border border-input bg-background px-1 py-0.5 text-xs text-foreground"
                  />
                ) : (
                  <span
                    className="flex-1 truncate min-w-0"
                    title={asset.filename}
                  >
                    {asset.filename}
                  </span>
                )}
                {!isRenaming && (
                  <>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatSize(asset.size)}
                    </span>
                    <button
                      type="button"
                      aria-label="Rename asset"
                      title="Rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenaming({ id: asset.id, value: asset.filename });
                      }}
                      className="invisible shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground group-hover:visible"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete asset"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(asset);
                      }}
                      className="invisible shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive group-hover:visible"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
        title={
          pendingDelete
            ? `Delete “${pendingDelete.filename}”?`
            : "Delete asset?"
        }
        description="The asset file will be removed. Tracks using this asset cannot be removed and will block deletion."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete) {
            const asset = pendingDelete;
            setPendingDelete(null);
            void performDelete(asset);
          }
        }}
      />
    </div>
  );
}
