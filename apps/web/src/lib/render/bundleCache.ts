import { bundle } from "@remotion/bundler";
import path from "node:path";

type BundleCacheStore = {
  bundleUrl: string | null;
  inFlight: Promise<string> | null;
};

const globalForBundle = globalThis as unknown as {
  __openEffectsBundleCache__?: BundleCacheStore;
};

const store: BundleCacheStore = globalForBundle.__openEffectsBundleCache__ ?? {
  bundleUrl: null,
  inFlight: null,
};
globalForBundle.__openEffectsBundleCache__ = store;

export async function getBundleUrl(): Promise<string> {
  if (store.bundleUrl) return store.bundleUrl;
  if (store.inFlight) return store.inFlight;
  store.inFlight = (async () => {
    const entry = path.resolve(
      process.cwd(),
      "../../packages/runtime/src/remotion-entry.tsx",
    );
    const result = await bundle({ entryPoint: entry });
    store.bundleUrl = result;
    store.inFlight = null;
    return result;
  })();
  return store.inFlight;
}
