"use client";

import { useEffect, useState } from "react";
import { Music, ImageIcon, Video, Type } from "lucide-react";
import { UploadButton } from "./UploadButton";

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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data: Asset[]) => setAssets(data))
      .catch(() => {});
  }, []);

  function addAsset(asset: Asset) {
    setAssets((prev) => [asset, ...prev]);
  }

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
        {visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No assets yet.</p>
        ) : (
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
