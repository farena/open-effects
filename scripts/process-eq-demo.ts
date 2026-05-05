import { processEq } from "../apps/web/src/lib/audio/processEq";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("usage: tsx scripts/process-eq-demo.ts <input.mp3>");
  process.exit(1);
}
const buf = readFileSync(input);
const sha = createHash("sha256").update(buf).digest("hex");
const eq = { low: 0, mid: 0, high: 0, presence: 6 };
processEq({ inputAbsPath: path.resolve(input), assetSha256: sha, eq })
  .then((out) => console.log("output:", out))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
