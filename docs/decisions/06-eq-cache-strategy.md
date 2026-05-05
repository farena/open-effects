# ADR 06 — EQ Cache Strategy

**Date:** 2026-05-05
**Status:** Accepted

## Context

EQ processing is applied at render time only, not during live preview. When a
user renders a composition, the FFmpeg `equalizer` filter chain is invoked once
per audio layer that has non-zero EQ gains. A four-band equalizer requires four
chained filter applications.

Because renders can be triggered multiple times — for example, after minor
timing edits that do not affect the EQ settings — re-encoding the same audio
asset with the same EQ configuration is wasteful. The source file content and
the EQ gains together fully determine the output; the result is pure and
deterministic. A file-based cache can eliminate redundant FFmpeg invocations
across render calls.

## Decision

### Cache key inputs

The cache key is derived from two inputs:

- `assetSha256` — the SHA-256 hash of the source audio file content. This
  ensures that if a file at the same path is replaced with different content,
  the old cached output is not mistakenly reused.
- Canonicalized `eq` object — each of the four gain bands (`low`, `mid`,
  `high`, `presence`) is converted to an integer representing 0.5 dB steps
  (i.e., `Math.round(gain / 0.5)`). The bands are serialized in a fixed
  canonical order, independent of the object key order at the call site. This
  produces a stable string for hashing regardless of how the caller constructs
  the EQ object.

`trim` (start/end offsets) is explicitly excluded from the cache key. Remotion
handles trimming at render time via `<Audio startFrom endAt>` props, so the
underlying processed audio file can be the full-duration EQ'd version; trimming
is applied on top by Remotion without re-encoding.

### Bypass condition

If `eq` is `null`, or if all four gain bands are exactly `0`, the function
returns the raw `assetPath` directly. No FFmpeg call is made and nothing is
written to the cache. This keeps the common no-EQ case free of any overhead.

### Storage location

Cached files are written to:

```
apps/web/.cache/audio/<sha256(cacheKey)>.<ext>
```

The file extension is the same as the source asset (e.g., `.mp3`, `.wav`). The
directory is created on demand if it does not exist. The `sha256(cacheKey)` is
computed over the combined string of `assetSha256` and the canonicalized EQ
parameters.

### Cleanup

Cleanup is deferred to v2 and is out of scope for this stage. The cache will
grow unbounded until a cleanup mechanism is added. A future option is a
script or scheduled task that deletes cache entries whose file mtime is older
than 30 days.

### Race condition handling

If two render calls request the same cache key simultaneously — for example,
in a future multi-process or concurrent render scenario — both will execute
FFmpeg and write to the same output path. Because the inputs are identical, both
writes produce the same bytes. Last write wins, and both callers succeed.

This is acceptable for the current single-user local rendering model.

## Consequences

- **Determinism:** Identical `(asset, EQ)` input pairs always hit the same
  cache entry. Changing any gain value by 0.5 dB or more produces a new cache
  entry.
- **Storage growth:** The cache is unbounded in v1. Projects with many distinct
  EQ configurations or many large audio assets will accumulate files until
  manual cleanup or the v2 cleanup task is implemented.
- **Render performance:** Cache hits bypass FFmpeg entirely and are essentially
  free. Only the first render with a given `(asset, EQ)` combination incurs the
  encoding cost.
- **Trim correctness:** Excluding trim from the cache key is safe because
  Remotion clips audio at render time. A single cached EQ'd file can serve all
  trim variants of the same asset and EQ combination.

## Alternatives Considered

- **In-memory LRU cache:** Rejected. An in-memory cache does not survive process
  restarts. Because renders are typically initiated in separate processes or
  after the server has been idle, a memory cache would provide no benefit across
  the most common usage pattern.

- **Include trim in the cache key:** Rejected. Including start/end trim offsets
  in the key would create a distinct cache entry for every unique trim
  combination, even when the EQ output is identical. Since Remotion handles
  trimming independently at render time, this would inflate cache storage for
  no benefit.

## References

- Stage 6 plan task T9: `eqCacheKey` utility implementation.
- Stage 6 plan task T11: `processEq` function that uses the cache key and
  bypass logic.
