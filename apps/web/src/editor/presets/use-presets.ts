"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoredPreset } from "@open-effects/shared-types";

type Phase =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; presets: StoredPreset[] };

/**
 * Loads the AnimationPreset catalog from `/api/presets`.
 *
 * Returns the raw stored presets (including the `id` / `isBuiltIn` fields the
 * editor uses for Edit/Delete affordances). To materialize a runtime
 * AnimationPreset, pipe each one through `animationPresetFromDefinition`.
 */
export function usePresets() {
  const [phase, setPhase] = useState<Phase>({ status: "loading" });

  const refresh = useCallback(async () => {
    setPhase({ status: "loading" });
    try {
      const res = await fetch("/api/presets");
      if (!res.ok) {
        setPhase({ status: "error", error: `HTTP ${res.status}` });
        return;
      }
      const data: StoredPreset[] = await res.json();
      setPhase({ status: "ready", presets: data });
    } catch (e) {
      setPhase({
        status: "error",
        error: e instanceof Error ? e.message : "Network error",
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    phase,
    presets: phase.status === "ready" ? phase.presets : [],
    isLoading: phase.status === "loading",
    error: phase.status === "error" ? phase.error : null,
    refresh,
  };
}
