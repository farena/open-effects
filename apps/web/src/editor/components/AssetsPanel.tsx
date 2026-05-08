"use client";

import { useCallback, useEffect, useState } from "react";
import { Music, ImageIcon, Video, Type, Upload } from "lucide-react";
import { UploadButton } from "./UploadButton";
import { LoadingSkeleton, ErrorBlock } from "@/components/ui/feedback";
import { EmptyState } from "./EmptyState";

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

  function addAsset(asset: Asset) {
    setPhase((p) =>
      p.status === "ready"
        ? { status: "ready", assets: [asset, ...p.assets] }
        : { status: "ready", assets: [asset] },
    );
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
          visible.map((asset) => (
            <div
              key={asset.id}
              draggable={asset.type === "audio"}
              onDragStart={
                asset.type === "audio"
                  ? (e) => {
                      e.dataTransfer.setData(
                        "application/x-asset",
                        JSON.stringify({ id: asset.id, path: asset.path }),
                      );
                    }
                  : undefined
              }
              className={[
                "flex items-center gap-2 rounded px-2 py-1.5 text-sm",
                asset.type === "audio"
                  ? "cursor-grab active:cursor-grabbing"
                  : "",
                "hover:bg-muted",
              ]
                .join(" ")
                .trim()}
            >
              <AssetIcon type={asset.type} />
              <span className="flex-1 truncate min-w-0">{asset.filename}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatSize(asset.size)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
