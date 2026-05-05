# Decision 08 — Render asset URLs

**Status:** Adopted.

**Date:** 2026-05-05

## Context

Stage 8's render pipeline calls `@remotion/renderer`'s `renderMedia` against a bundled
composition served via `@remotion/bundler`. Compositions reference audio assets through
`<Audio src=...>`. The renderer runs headless Chromium against the bundle's serve URL,
so the `src` must resolve from that context.

The original DB-backed audio paths are public URLs of the form `/assets/<sha>.<ext>`,
served by Next.js from `apps/web/public/assets/`. The pipeline must also serve
EQ-processed audio that lives outside `public/`, in Stage 6's cache at
`<cwd>/.cache/audio/<eq-key>.<ext>`.

## Options considered

- **A. Symlink/mount `public/assets/` and `.cache/audio/` into the bundle's static
  dir.** Requires bundler-side configuration, plus a writable mount for the EQ cache.
- **B. Serve audio via HTTP from the Next dev server.** Raw assets are already served
  at `http://<base>/assets/...`; EQ-processed files require a small proxy route that
  streams from `.cache/audio/`.
- **C. Use `file://` URLs.** Initially attempted. **Rejected:** Remotion 4's
  `renderMedia` rejects non-HTTP(S) URLs at the asset-download stage with
  `Can only download URLs starting with http:// or https://`. Confirmed empirically.

## Decision

Adopt **Option B**.

`apps/web/src/lib/render/buildRenderProject.ts` rewrites every `AudioTrack.assetPath`
based on whether `processEq` returned a bypass (raw input) or a cached EQ output:

- **Bypass (no EQ):** `assetPath` becomes
  `<RENDER_BASE_URL><originalPublicPath>`, e.g.
  `http://localhost:3000/assets/<sha>.mp3`. Served by Next directly from `public/`.
- **EQ-processed:** `assetPath` becomes
  `<RENDER_BASE_URL>/api/render/eq-asset/<encoded-filename>`. Served by the new
  route `apps/web/src/app/api/render/eq-asset/[filename]/route.ts`, which streams the
  file from `<cwd>/.cache/audio/<filename>` after path-traversal validation.

`RENDER_BASE_URL` is read from `process.env.RENDER_BASE_URL` and defaults to
`http://localhost:3000`. Override in non-default deployments.

## Consequences

- The Next server (dev or prod) must be reachable from the renderer process at
  `RENDER_BASE_URL` for the duration of the render. In our single-process dev
  setup this is automatic; the render is initiated by the same server it fetches from.
- The EQ cache stays at `<cwd>/.cache/audio/` (Stage 6 unchanged); the new proxy
  route is the only new surface area.
- Future cloud-rendering work (workers separate from the web app) must either keep
  `RENDER_BASE_URL` reachable across the network or migrate to Option A (uploading
  assets into the bundle).

## Security note

The eq-asset route accepts only a filename (no path components, no `..`) and joins
it strictly under `<cwd>/.cache/audio/`. This prevents traversal but does not
authenticate the caller; the route is currently open. Acceptable for v1
single-user dev; if the app is ever exposed publicly, gate this route behind
session or a render-time signed token.
