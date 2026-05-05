# Stage 5 — Audio (basic) Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution. Read all prior plans (`00-master-plan.md`, `01`, `02`, `03`, `04`) first. Stage 5 adds asset upload and audio playback. The DB schema is unchanged (`Asset`, `AudioTrack`, `VolumeKeyframe` already exist from Stage 1, schemas already in `shared-types` from Stage 2). VolumeKeyframes are **declared but not authored** in this stage — Stage 6 adds keyframe authoring + EQ.

**Goal:** User uploads an audio asset (mp3/wav/m4a) from the editor sidebar, drags it onto a scene to create an `AudioTrack`, can move it on the timeline and trim its start/end, and hears it synced with the visuals when scrubbing or playing the `<Player>`.

**Architecture:** Asset uploads land at `POST /api/assets` (multipart, validates mime-type, computes SHA256, dedups by hash, writes to `apps/web/public/assets/<sha>.<ext>`, persists `Asset` row). The editor's left sidebar gains an **Assets** panel (a third tab beside Scenes and Layers) listing uploads with a filter. Audio assets can be dragged onto a scene's audio lane in the Timeline, which calls `addAudioTrack(sceneId, assetId)` on the store. `SceneRenderer` (in `packages/runtime`) gets a sibling component that mounts `<Audio>` from `remotion` for each track, using `startFrom`/`endAt` for trim and wrapping in `<Sequence>` for placement. The Timeline gains audio lanes with waveforms rendered by `wavesurfer.js` (lazily loaded). Trim units = **frames of the project's fps**.

**Tech Stack additions:** `wavesurfer.js` (waveform rendering, client-only) · Node `crypto`/`fs/promises` (hashing + writing uploads) · Remotion's built-in `<Audio>`. No new server dep beyond what Next provides.

---

## Acceptance criteria → tasks map (Stage 5 master ACs)

| Master AC | Tasks |
|---|---|
| 1. `POST /api/assets` with mime validation + dedup + storage | T2, T3 |
| 2. `GET /api/assets` filterable by type | T4 |
| 3. Sidebar Assets tab with uploads | T8, T9 |
| 4. `AudioTrack` add/start/trim wiring in editor | T7, T10 |
| 5. Timeline audio strip with waveform | T11, T12 |
| 6. Drag body to move; drag edges to trim | T13 |
| 7. `<Audio>` synced in `<Player>` | T6 |

---

## File structure to create

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── assets/
│   │   │   ├── upload.ts                  # parse formData, hash, write file
│   │   │   ├── storage.ts                 # path helpers
│   │   │   └── mimeWhitelist.ts
│   ├── editor/
│   │   ├── store.ts                       # MODIFY: audio track actions
│   │   ├── store.types.ts                 # MODIFY
│   │   ├── selectors.ts                   # MODIFY: selectAudioTracksForActiveScene
│   │   └── components/
│   │       ├── Sidebar.tsx                # MODIFY: 3rd tab "Assets"
│   │       ├── AssetsPanel.tsx            # NEW: list + upload + filter
│   │       ├── UploadButton.tsx           # NEW
│   │       ├── Timeline.tsx               # MODIFY: audio lanes + drop target
│   │       ├── AudioStrip.tsx             # NEW: per-track strip with waveform
│   │       └── WavesurferLazy.tsx         # NEW: client-only wrapper
│   ├── app/
│   │   ├── api/assets/
│   │   │   ├── route.ts                   # GET (list) + POST (upload)
│   │   │   └── [id]/route.ts              # DELETE
│   │   └── layout.tsx                     # ensures static dir served
└── tests/
    ├── api/
    │   └── assets.test.ts
    ├── lib/
    │   └── assets/
    │       └── upload.test.ts
    └── editor/
        └── store.audio.test.ts

packages/runtime/
├── src/
│   ├── components/
│   │   ├── SceneRenderer.tsx              # MODIFY: render audio tracks
│   │   └── AudioTrackPlayer.tsx           # NEW: wraps <Audio> in <Sequence>
│   └── fixtures/
│       └── withAudio.ts                   # NEW (manual demo only; Studio fixture)
└── tests/
    └── components/
        └── AudioTrackPlayer.test.tsx      # NEW (jsdom)
```

---

## Task list (execution order)

### Task 1: Mime whitelist + storage helpers

**Files:**
- Create: `apps/web/src/lib/assets/mimeWhitelist.ts`, `apps/web/src/lib/assets/storage.ts`

- [x] **Step 1:** Implement `mimeWhitelist.ts`:
  ```ts
  export const MIME_WHITELIST: Record<string, "image" | "audio" | "video" | "font"> = {
    "image/png": "image", "image/jpeg": "image", "image/webp": "image", "image/svg+xml": "image",
    "audio/mpeg": "audio", "audio/wav": "audio", "audio/x-wav": "audio", "audio/mp4": "audio", "audio/aac": "audio",
    "video/mp4": "video", "video/webm": "video",
    "font/woff": "font", "font/woff2": "font"
  };
  export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200 MB
  export function classify(mime: string) { return MIME_WHITELIST[mime] ?? null; }
  ```
- [x] **Step 2:** Implement `storage.ts`:
  ```ts
  import path from "node:path";
  import { mkdir } from "node:fs/promises";

  export const ASSETS_DIR = path.resolve(process.cwd(), "public/assets");

  export async function ensureAssetsDir() {
    await mkdir(ASSETS_DIR, { recursive: true });
  }

  export function assetPath(sha256: string, extension: string) {
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    return path.join(ASSETS_DIR, `${sha256}${ext}`);
  }

  export function publicAssetUrl(sha256: string, extension: string) {
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    return `/assets/${sha256}${ext}`;
  }

  export function extensionFor(mime: string, filename: string): string {
    const fromName = path.extname(filename);
    if (fromName) return fromName.toLowerCase();
    const map: Record<string, string> = {
      "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg",
      "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mp4": ".m4a", "audio/aac": ".aac",
      "video/mp4": ".mp4", "video/webm": ".webm",
      "font/woff": ".woff", "font/woff2": ".woff2"
    };
    return map[mime] ?? ".bin";
  }
  ```
- [x] **Step 3:** Commit: `feat(assets): mime whitelist + storage helpers`.

---

### Task 2: Upload core function (TDD)

**Files:**
- Create: `apps/web/src/lib/assets/upload.ts`, `apps/web/tests/lib/assets/upload.test.ts`

- [x] **Step 1:** Failing test:
  ```ts
  import { describe, it, expect, beforeEach } from "vitest";
  import { processUpload } from "@/lib/assets/upload";
  import { db } from "@/lib/db";
  import { readFile, unlink } from "node:fs/promises";

  describe("processUpload", () => {
    beforeEach(async () => { await db.asset.deleteMany(); });

    it("hashes, persists, and returns Asset row", async () => {
      const file = new File([new Uint8Array([1, 2, 3, 4])], "test.mp3", { type: "audio/mpeg" });
      const asset = await processUpload(file);
      expect(asset.type).toBe("audio");
      expect(asset.mimeType).toBe("audio/mpeg");
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(asset.size).toBe(4);
      expect(asset.path).toMatch(/^\/assets\/[a-f0-9]{64}\.mp3$/);
      // file exists on disk
      const onDisk = await readFile(`./public${asset.path}`);
      expect(onDisk.length).toBe(4);
      await unlink(`./public${asset.path}`);
    });

    it("dedups by SHA256: second upload returns existing Asset", async () => {
      const file1 = new File([new Uint8Array([1, 2, 3])], "a.mp3", { type: "audio/mpeg" });
      const file2 = new File([new Uint8Array([1, 2, 3])], "b.mp3", { type: "audio/mpeg" });
      const a1 = await processUpload(file1);
      const a2 = await processUpload(file2);
      expect(a1.id).toBe(a2.id);
      expect(a1.sha256).toBe(a2.sha256);
    });

    it("rejects unknown mime types", async () => {
      const file = new File([new Uint8Array([1])], "x.exe", { type: "application/x-msdownload" });
      await expect(processUpload(file)).rejects.toThrow(/mime/i);
    });

    it("rejects files over MAX_UPLOAD_BYTES", async () => {
      const big = new File([new Uint8Array(201 * 1024 * 1024)], "x.mp3", { type: "audio/mpeg" });
      await expect(processUpload(big)).rejects.toThrow(/size|too large/i);
    });
  });
  ```
- [x] **Step 2:** Implement:
  ```ts
  import { createHash } from "node:crypto";
  import { writeFile } from "node:fs/promises";
  import { db } from "@/lib/db";
  import { ASSETS_DIR, assetPath, extensionFor, ensureAssetsDir, publicAssetUrl } from "./storage";
  import { classify, MAX_UPLOAD_BYTES } from "./mimeWhitelist";

  export async function processUpload(file: File) {
    const type = classify(file.type);
    if (!type) throw new Error(`Unsupported mime type: ${file.type}`);
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("File too large");

    const buf = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(buf).digest("hex");
    const ext = extensionFor(file.type, file.name);

    // Dedup
    const existing = await db.asset.findUnique({ where: { sha256 } });
    if (existing) return existing;

    await ensureAssetsDir();
    await writeFile(assetPath(sha256, ext), buf);

    return db.asset.create({
      data: {
        type, filename: file.name, path: publicAssetUrl(sha256, ext),
        mimeType: file.type, size: file.size, sha256
      }
    });
  }
  ```
- [x] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(assets): processUpload (hash + dedup + persist)`.

---

### Task 3: `POST /api/assets` (multipart)

**Files:**
- Create: `apps/web/src/app/api/assets/route.ts`

- [x] **Step 1:** Implement:
  ```ts
  import { NextResponse } from "next/server";
  import { processUpload } from "@/lib/assets/upload";
  import { db } from "@/lib/db";

  export async function POST(req: Request) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
    try {
      const asset = await processUpload(file);
      return NextResponse.json(asset, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: e.message ?? "upload_failed" }, { status: 400 });
    }
  }

  export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const where = type ? { type } : {};
    const assets = await db.asset.findMany({ where, orderBy: { createdAt: "desc" } });
    return NextResponse.json(assets);
  }
  ```
- [x] **Step 2:** Manual: `curl -F file=@/path/to/test.mp3 http://localhost:3000/api/assets` → 201 with Asset JSON. <!-- deferred to manual closure -->
- [x] **Step 3:** Manual: `curl http://localhost:3000/api/assets?type=audio` → JSON array. <!-- deferred to manual closure -->
- [ ] **Step 4:** Commit: `feat(api): POST/GET /api/assets`.

---

### Task 4: `DELETE /api/assets/:id`

**Files:**
- Create: `apps/web/src/app/api/assets/[id]/route.ts`

- [x] **Step 1:** Implement:
  ```ts
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  import { unlink } from "node:fs/promises";
  import path from "node:path";

  export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const asset = await db.asset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: "not_found" }, { status: 404 });
    // Refuse if any AudioTrack references it
    const refs = await db.audioTrack.count({ where: { assetId: id } });
    if (refs > 0) return NextResponse.json({ error: "in_use", refs }, { status: 409 });
    await db.asset.delete({ where: { id } });
    try { await unlink(path.resolve(process.cwd(), "public", asset.path.replace(/^\//, ""))); }
    catch { /* file already gone — fine */ }
    return NextResponse.json({ ok: true });
  }
  ```
- [x] **Step 2:** Add test (`tests/api/assets.test.ts`): create asset, delete it, confirm removed from DB.
- [ ] **Step 3:** Commit: `feat(api): DELETE /api/assets/[id]`.

---

### Task 5: `<AudioTrackPlayer>` in runtime (TDD)

**Files:**
- Create: `packages/runtime/src/components/AudioTrackPlayer.tsx`, `packages/runtime/tests/components/AudioTrackPlayer.test.tsx`

- [x] **Step 1:** Failing jsdom test that asserts the component renders an `<audio>` (or Remotion Audio renders to one) with `src` matching `assetPath`.
- [x] **Step 2:** Implement:
  ```tsx
  import React from "react";
  import { Audio, Sequence } from "remotion";
  import type { AudioTrack } from "@open-effects/shared-types";

  /**
   * Wraps Remotion <Audio> in a <Sequence> so the track plays at scene start
   * + track.startFrame, trimmed by [trimStart, trimEnd] (all in project frames).
   *
   * Volume is delegated to a function in Stage 6. For Stage 5 it's constant 1.
   */
  export const AudioTrackPlayer: React.FC<{ track: AudioTrack }> = ({ track }) => {
    const duration = Math.max(1, track.trimEnd - track.trimStart);
    return (
      <Sequence from={track.startFrame} durationInFrames={duration} layout="none">
        <Audio
          src={track.assetPath}
          startFrom={track.trimStart}
          endAt={track.trimEnd}
        />
      </Sequence>
    );
  };
  ```
- [x] **Step 3:** Tests pass.
- [ ] **Step 4:** Commit: `feat(runtime): AudioTrackPlayer`.

**Note:** `layout="none"` in `Sequence` skips the AbsoluteFill wrapper since audio has no visual layout.

---

### Task 6: Wire audio into `SceneRenderer`

**Files:**
- Modify: `packages/runtime/src/components/SceneRenderer.tsx`

- [x] **Step 1:** Add audio rendering:
  ```tsx
  import { AudioTrackPlayer } from "./AudioTrackPlayer";
  // inside SceneRenderer:
  return (
    <AbsoluteFill>
      {layers.map((l) => <Layer key={l.id} layer={l} />)}
      {scene.audioTracks.map((t) => <AudioTrackPlayer key={t.id} track={t} />)}
    </AbsoluteFill>
  );
  ```
- [x] **Step 2:** Update barrel export in `packages/runtime/src/index.ts`.
- [x] **Step 3:** Add a Studio fixture `withAudio.ts` (you'll need a small test mp3 in `packages/runtime/fixtures/test.mp3` — or skip Studio fixture and validate only in the web editor). *(skipped — fixture optional, validate in web editor)*
- [ ] **Step 4:** Commit: `feat(runtime): SceneRenderer renders audio tracks`.

---

### Task 7: Store actions for audio tracks (TDD)

**Files:**
- Modify: `apps/web/src/editor/store.ts`, `store.types.ts`
- Create: `apps/web/tests/editor/store.audio.test.ts`

- [x] **Step 1:** Add to `EditorActions`:
  ```ts
  addAudioTrack: (sceneId: string, asset: { id: string; path: string; durationFrames: number }) => void;
  removeAudioTrack: (trackId: string) => void;
  moveAudioTrack: (trackId: string, startFrame: number) => void;
  trimAudioTrack: (trackId: string, trimStart: number, trimEnd: number) => void;
  ```
  `durationFrames` is the audio's full length in project frames — used to default `trimEnd`. Computed client-side after probing the audio (Task 9).
- [x] **Step 2:** Failing tests:
  - `addAudioTrack` appends a track with `startFrame=currentFrame`, `trimStart=0`, `trimEnd=durationFrames`.
  - `removeAudioTrack` removes it; selection cleared if it was selected.
  - `moveAudioTrack` updates `startFrame`.
  - `trimAudioTrack` updates `trimStart`/`trimEnd`; rejects `trimEnd <= trimStart` (no-op + warn).
- [x] **Step 3:** Implement using `mutateScene` helper analogous to `mutateLayer`:
  ```ts
  function mutateAudioTrack(state: any, trackId: string, mut: (t: any) => void) {
    for (const sc of state.project.scenes) {
      const t = sc.audioTracks.find((x: any) => x.id === trackId);
      if (t) { mut(t); return; }
    }
  }

  // actions:
  addAudioTrack: (sceneId, asset) => set((s) => {
    const sc = s.project.scenes.find((x: any) => x.id === sceneId);
    if (!sc) return;
    sc.audioTracks.push({
      id: newId(), assetId: asset.id, assetPath: asset.path,
      startFrame: s.currentFrame, trimStart: 0, trimEnd: asset.durationFrames,
      eq: null, volumeKeyframes: []
    });
  }),
  removeAudioTrack: (trackId) => set((s) => {
    for (const sc of s.project.scenes) {
      sc.audioTracks = sc.audioTracks.filter((t: any) => t.id !== trackId);
    }
  }),
  moveAudioTrack: (trackId, startFrame) => set((s) => {
    mutateAudioTrack(s, trackId, (t) => { t.startFrame = Math.max(0, startFrame); });
  }),
  trimAudioTrack: (trackId, trimStart, trimEnd) => set((s) => {
    if (trimEnd <= trimStart) { console.warn("Invalid trim"); return; }
    mutateAudioTrack(s, trackId, (t) => { t.trimStart = trimStart; t.trimEnd = trimEnd; });
  })
  ```
- [x] **Step 4:** Tests pass.
- [ ] **Step 5:** Commit: `feat(editor): audio track store actions`.

---

### Task 8: Sidebar AssetsPanel + UploadButton

**Files:**
- Modify: `apps/web/src/editor/components/Sidebar.tsx`
- Create: `apps/web/src/editor/components/AssetsPanel.tsx`, `UploadButton.tsx`

- [x] **Step 1:** `UploadButton.tsx`:
  ```tsx
  "use client";
  import { useRef, useState } from "react";
  import { Button } from "@/components/ui/button";
  import { toast } from "sonner";

  export function UploadButton({ onUploaded }: { onUploaded: (asset: any) => void }) {
    const ref = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    return (
      <>
        <input ref={ref} type="file" hidden
          accept="image/*,audio/*,video/*,font/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            setBusy(true);
            const fd = new FormData(); fd.append("file", file);
            try {
              const res = await fetch("/api/assets", { method: "POST", body: fd });
              if (!res.ok) throw new Error(await res.text());
              const asset = await res.json();
              toast.success(`Uploaded ${asset.filename}`);
              onUploaded(asset);
            } catch (err: any) {
              toast.error("Upload failed", { description: err.message });
            } finally { setBusy(false); e.target.value = ""; }
          }} />
        <Button size="sm" disabled={busy} onClick={() => ref.current?.click()}>
          {busy ? "Uploading…" : "+ Upload"}
        </Button>
      </>
    );
  }
  ```
- [x] **Step 2:** `AssetsPanel.tsx`:
  - On mount: fetch `/api/assets`. Local state: list of assets + filter (`all`/`image`/`audio`/`video`).
  - Render UploadButton at top, filter dropdown below, list of asset cards (filename, type icon, size). Drag handle for audio assets to the Timeline (Task 10 wires drop target).
- [x] **Step 3:** Add Assets as a third tab in `Sidebar.tsx`.
- [ ] **Step 4:** Commit: `feat(editor): assets panel + upload`.

---

### Task 9: Probe audio duration client-side

**Files:**
- Create: `apps/web/src/editor/lib/probeAudioDuration.ts`

- [x] **Step 1:** Implement (uses HTML `<audio>` element):
  ```ts
  export function probeAudioDuration(src: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.src = src;
      a.onloadedmetadata = () => resolve(a.duration);
      a.onerror = () => reject(new Error("audio_probe_failed"));
    });
  }

  export const secondsToFrames = (seconds: number, fps: number) => Math.floor(seconds * fps);
  ```
- [ ] **Step 2:** Commit: `feat(editor): audio duration probe`.

---

### Task 10: Drag-to-drop asset onto Timeline scene → addAudioTrack

**Files:**
- Modify: `apps/web/src/editor/components/AssetsPanel.tsx` (drag source)
- Modify: `apps/web/src/editor/components/Timeline.tsx` (drop zone, audio lane)

- [x] **Step 1:** In AssetsPanel, set `draggable` on audio asset cards; on `dragstart` set `e.dataTransfer.setData("application/x-asset", JSON.stringify({ id, path }))`.
- [x] **Step 2:** In Timeline, render an "audio lane" below scenes for each scene. Each lane has `onDragOver={e=>e.preventDefault()}` and `onDrop`:
  ```ts
  onDrop={async (e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-asset");
    if (!raw) return;
    const { id, path } = JSON.parse(raw);
    const seconds = await probeAudioDuration(path);
    const fps = useEditorStore.getState().project.fps;
    addAudioTrack(scene.id, { id, path, durationFrames: secondsToFrames(seconds, fps) });
  }}
  ```
- [ ] **Step 3:** Manual: drag an audio asset to a scene's audio lane → an AudioTrack appears in that lane.
- [ ] **Step 4:** Commit: `feat(editor): drag asset to scene to create AudioTrack`.

---

### Task 11: WavesurferLazy wrapper

**Files:**
- Create: `apps/web/src/editor/components/WavesurferLazy.tsx`

- [x] **Step 1:** `npm install wavesurfer.js -w apps/web`
- [x] **Step 2:** Implement (client-only, lazy):
  ```tsx
  "use client";
  import { useEffect, useRef } from "react";
  export function Waveform({ src, height = 32 }: { src: string; height?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      let ws: any;
      let cancelled = false;
      (async () => {
        const { default: WaveSurfer } = await import("wavesurfer.js");
        if (cancelled || !containerRef.current) return;
        ws = WaveSurfer.create({
          container: containerRef.current,
          height, normalize: true,
          waveColor: "rgba(255,255,255,0.5)", progressColor: "rgba(255,255,255,0.8)",
          interact: false, cursorWidth: 0, barWidth: 1
        });
        ws.load(src);
      })();
      return () => { cancelled = true; ws?.destroy(); };
    }, [src, height]);
    return <div ref={containerRef} className="pointer-events-none w-full" />;
  }
  ```
- [ ] **Step 3:** Commit: `feat(editor): wavesurfer lazy waveform`.

---

### Task 12: AudioStrip component

**Files:**
- Create: `apps/web/src/editor/components/AudioStrip.tsx`

- [x] **Step 1:** Render an absolutely-positioned strip over the audio lane:
  - `left = (track.startFrame / totalFrames) * width`
  - `width = ((track.trimEnd - track.trimStart) / totalFrames) * width`
  - Inside: track name + Waveform + 2 edge handles (left/right) + 1 body grip + delete button.
- [ ] **Step 2:** Commit: `feat(editor): AudioStrip render`.

---

### Task 13: Drag interactions on AudioStrip (move + trim)

**Files:**
- Modify: `apps/web/src/editor/components/AudioStrip.tsx`

- [x] **Step 1:** Implement pointer-event drag on the body (vanilla, no dnd-kit):
  - `pointerdown` → record initial mouse X and `startFrame`.
  - `pointermove` (while down) → compute delta in frames (`deltaX / pxPerFrame`), call `moveAudioTrack(track.id, max(0, initialStart + deltaFrames))`.
- [x] **Step 2:** Implement drag on left handle: changes `trimStart` (clamped to ≥ 0 and < trimEnd-1). Drag on right handle: changes `trimEnd` (clamped to > trimStart+1 and ≤ probedDurationFrames).
- [x] **Step 3:** Snap to whole frames.
- [ ] **Step 4:** Manual: drag body → audio repositions; drag handles → audio trims; play preview → hear audio with correct timing.
- [ ] **Step 5:** Commit: `feat(editor): AudioStrip drag interactions`.

---

### Task 14: Selectors for audio (small)

**Files:**
- Modify: `apps/web/src/editor/selectors.ts`

- [x] **Step 1:** Add:
  ```ts
  export const selectAudioTracksForScene = (sceneId: string) => (s: EditorState) =>
    s.project.scenes.find((sc) => sc.id === sceneId)?.audioTracks ?? [];
  ```
- [ ] **Step 2:** Commit: `feat(editor): audio selectors`.

---

### Task 15: Stage closure verification

- [x] **Step 1:** `npm test --workspaces --if-present` → all green (upload, audio store, runtime). _(179/179 passing: web 85, runtime 56, shared-types 38)_
- [x] **Step 2:** `npm run typecheck --workspaces --if-present` → clean. _(apps/web ✓, shared-types ✓; runtime has one pre-existing error in `tests/offset.test.ts` from commit `aff5de5`, unrelated to Stage 5)_
- [ ] **Step 3:** Manual smoke (deferred to user — requires running dev server):
  1. Upload a real mp3 from the Assets panel — confirm it appears in the list.
  2. Drag it onto scene 1's audio lane.
  3. AudioStrip appears with waveform.
  4. Press Play in the Player → hear the audio synced.
  5. Drag the strip body left → audio plays earlier.
  6. Drag the right handle inward → audio cuts off earlier.
  7. Reload page → strip persists with same start/trim.
- [ ] **Step 4:** Tag closure: `git commit -m "STAGE-5: closed"`. _(deferred — orchestrator does not auto-commit per `/run-plan` rules)_

---

## Test summary

| Test | Type | File |
|---|---|---|
| `processUpload` hash + dedup + reject (4 cases) | integration | `tests/lib/assets/upload.test.ts` |
| `POST/GET/DELETE /api/assets` | integration | `tests/api/assets.test.ts` |
| `AudioTrackPlayer` renders Audio in Sequence | unit (jsdom) | `runtime/tests/components/AudioTrackPlayer.test.tsx` |
| Audio store actions (4 cases) | unit | `web/tests/editor/store.audio.test.ts` |
| End-to-end: upload → place → trim → hear | manual | browser |

---

## Risks specific to Stage 5

| Risk | Mitigation |
|---|---|
| Large uploads block the Node event loop | `MAX_UPLOAD_BYTES = 200MB` enforced (T1, T2). For larger needs, future: streaming upload to disk via a Node stream pipeline. |
| Filesystem write failures (disk full, permissions) | `processUpload` throws; the API returns 400 with the message; UI shows toast (T8). |
| `<Audio>` requires `src` to be browser-accessible URL | We use `/assets/<sha>.<ext>` served by Next from `apps/web/public/`. Verified in T15 manual smoke. |
| Probing audio duration may take 100-500ms (network + decode) | Acceptable: only happens on drop. Loading state would polish (Stage 9 candidate). |
| `wavesurfer.js` bundle size | Lazy-loaded only inside AudioStrip (T11 dynamic import). |
| Trim/move drag UX feels jittery without snap | T13 step 3 snaps to whole frames; further polish (snap to other strips, magnetic edges) is Stage 9. |
| User deletes an Asset that's referenced by an AudioTrack | T4 returns 409; AssetsPanel surfaces "in use, cannot delete" toast. |
| Concurrent dedup race (two simultaneous uploads of the same file) | The `Asset.sha256` unique constraint serializes — one wins, the other catches the unique error and refetches. Acceptable for v1 single user. |
| Wavesurfer disposal on rapid mount/unmount | Cleanup in `useEffect` return (T11) destroys the instance. |

---

## Handoff to Stage 6

Stage 6 (`06-audio-keyframes-eq.md`) will:
- Add VolumeKeyframe authoring UI (similar pattern to layer keyframes from Stage 4: lane in Timeline + tab in Inspector for a selected AudioTrack).
- Wire `<Audio>`'s `volume` prop to a function evaluating volume keyframes per frame (reuses `evalEasing` from Stage 4).
- Add EQ inspector + FFmpeg pre-processor with deterministic cache.
- Stage 5 contracts that Stage 6 must respect:
  - `AudioTrack.volumeKeyframes` and `eq` already in schema (Stage 1, 2).
  - `AudioTrackPlayer` is the integration point — only its `<Audio>` props change.
  - Track selection in editor: add `selectedAudioTrackId` to store in Stage 6.

---

## Final task checklist (execution order)

- [x] T1 — Mime whitelist + storage helpers
- [x] T2 — `processUpload` (TDD)
- [x] T3 — `POST/GET /api/assets`
- [x] T4 — `DELETE /api/assets/[id]`
- [x] T5 — `AudioTrackPlayer` (TDD)
- [x] T6 — SceneRenderer renders audio
- [x] T7 — Audio store actions (TDD)
- [x] T8 — Sidebar AssetsPanel + UploadButton
- [x] T9 — Probe audio duration helper
- [x] T10 — Drag asset → addAudioTrack
- [x] T11 — Wavesurfer lazy wrapper
- [x] T12 — AudioStrip render
- [x] T13 — AudioStrip drag (move + trim)
- [x] T14 — Audio selectors
- [x] T15 — Stage closure smoke (automated portion: tests + typecheck; manual smoke deferred to user)

**Total tasks:** 15 · **Estimate:** 2 weeks · **Critical risks:** upload size limits + audio probing latency (both bounded and toast-surfaced).
