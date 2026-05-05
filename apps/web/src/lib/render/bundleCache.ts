import { bundle } from "@remotion/bundler";
import path from "node:path";

let bundleUrl: string | null = null;
let inFlight: Promise<string> | null = null;

export async function getBundleUrl(): Promise<string> {
  if (bundleUrl) return bundleUrl;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const entry = path.resolve(
      process.cwd(),
      "../../packages/runtime/src/Root.tsx",
    );
    const result = await bundle({ entryPoint: entry });
    bundleUrl = result;
    inFlight = null;
    return result;
  })();
  return inFlight;
}
