import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// Resolve repo root from apps/web/tests so DATABASE_URL is loaded before @/lib/db.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..");

config({ path: path.join(repoRoot, ".env.test"), override: true });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Copy .env.test.example to .env.test at the repo root and set DATABASE_URL for the test database.",
  );
}
