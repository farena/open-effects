# Decision 08 — Render asset URLs

**Status:** Adopted (pending end-to-end smoke verification — Stage 8 Task 11).

**Date:** 2026-05-05

## Context

Stage 8's render pipeline calls `@remotion/renderer`'s `renderMedia` against a bundled
composition served via `@remotion/bundler`. Compositions reference audio assets through
`<Audio src=...>`. The renderer runs headless Chromium against the bundle's serve URL,
so the `src` must resolve from that context.

The original DB-backed audio paths are public URLs of the form `/assets/<sha>.<ext>`,
served by Next.js from `apps/web/public/assets/`. Those are not reachable from the
bundle's static serve context, and may include EQ-processed cache files outside `public/`
(see Stage 6's `processEq` cache under `<repo>/.cache/audio/`).

## Options considered

- **A. Symlink `apps/web/public/assets/` into the bundle's static dir.** Works, but
  requires bundler post-processing and breaks when `processEq` returns a path under
  `.cache/audio/` (outside `public/`).
- **B. Serve audio via `http://localhost:3000/assets/...`.** Works only when the dev
  server is running. Brittle for production headless renders. Rejected.
- **C. Use `file://<absolute-path>` URLs.** Remotion 4's headless Chromium accepts
  `file://` URLs for media. The render-time `buildRenderProject` already rewrites
  `assetPath` to `file://<absoluteResolvedPath>` (covering both raw assets in
  `public/assets/` and EQ-processed caches in `.cache/audio/`).

## Decision

Adopt **Option C** (`file://` URLs).

`apps/web/src/lib/render/buildRenderProject.ts` rewrites every `AudioTrack.assetPath`
to `file://<absolute>` after asset resolution and EQ processing. No bundler changes
or HTTP fallback are required.

## Verification

End-to-end smoke (Stage 8 Task 11):

1. Render a project with at least one audio track that has volume keyframes and EQ.
2. Confirm the output MP4 plays the audio with both fade and EQ tonal change audible.

If the smoke surfaces silent audio or a Remotion error around asset loading, this
document must be revised and the implementation switched to Option A (symlinks +
serving the EQ cache from a writable static dir under the bundle's serve URL).

## Consequences

- Renders are not portable across machines (the path is absolute on the rendering host).
  Acceptable: renders happen on the server that holds the assets.
- The EQ cache directory (`.cache/audio/`) must be writable by the Node process and
  must persist for the duration of the render. Already true.
- Future cloud-rendering work would need to revisit this and adopt Option A or upload
  assets into the bundle.
