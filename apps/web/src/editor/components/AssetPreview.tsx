"use client";

import { useEffect, useState } from "react";
import { Music, Type } from "lucide-react";
import type { PreviewedAsset } from "@/editor/store.types";

interface AssetPreviewProps {
  asset: PreviewedAsset;
}

export function AssetPreview({ asset }: AssetPreviewProps) {
  if (asset.type === "image") {
    return (
      <div className="flex h-full max-h-full w-full items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.path}
          alt={asset.filename}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (asset.type === "video") {
    return (
      <div className="flex h-full max-h-full w-full items-center justify-center">
        <video
          key={asset.path}
          src={asset.path}
          controls
          autoPlay
          playsInline
          className="max-h-full max-w-full"
        />
      </div>
    );
  }

  if (asset.type === "audio") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-white/90">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
          <Music className="h-12 w-12" />
        </div>
        <div className="max-w-md text-center text-sm font-medium">
          {asset.filename}
        </div>
        <audio
          key={asset.path}
          src={asset.path}
          controls
          autoPlay
          className="w-full max-w-md"
        />
      </div>
    );
  }

  if (asset.type === "font") {
    return <FontPreview asset={asset} />;
  }

  return (
    <div className="text-sm text-white/70">No preview available.</div>
  );
}

function FontPreview({ asset }: { asset: PreviewedAsset }) {
  const familyName = `oe-font-preview-${asset.id}`;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    if (typeof document === "undefined") return;
    const face = new FontFace(familyName, `url(${asset.path})`);
    let cancelled = false;
    face
      .load()
      .then((f) => {
        if (cancelled) return;
        document.fonts.add(f);
        setLoaded(true);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
      try {
        document.fonts.delete(face);
      } catch {
        /* ignore */
      }
    };
  }, [asset.path, familyName]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-8 text-white">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/60">
        <Type className="h-3.5 w-3.5" />
        <span>{asset.filename}</span>
        {!loaded && <span>(loading…)</span>}
      </div>
      <div
        className="max-w-3xl text-center"
        style={{ fontFamily: loaded ? `"${familyName}", sans-serif` : "sans-serif" }}
      >
        <div className="text-6xl leading-tight">Aa Bb Cc</div>
        <div className="mt-4 text-2xl text-white/80">
          The quick brown fox jumps over the lazy dog.
        </div>
        <div className="mt-2 text-base text-white/60 tabular-nums">
          0 1 2 3 4 5 6 7 8 9
        </div>
      </div>
    </div>
  );
}
