# Stage 1 — Foundation Stack Implementation Plan

> **For agentic workers:** REQUIRED SKILL: `write-plan` for planning and `implementator`/`reviewer` for execution and validation. Read `00-master-plan.md` first for global context. This plan covers ONLY Stage 1 — do not pull work from later stages.

**Goal:** Bootstrap the `open-effects` monorepo so a fresh dev can clone, run `npm install && npm run db:migrate && npm run dev`, and within 10 minutes hit `localhost:3000` showing the landing page and `/projects` listing an empty array.

**Architecture:** npm workspaces with `apps/web` (Next.js 15 App Router full-stack), `packages/runtime` (skeleton only — implemented in Stage 2), and `packages/shared-types` (skeleton only — schemas added in Stage 2). MariaDB running externally (existing container), accessed by Prisma with `provider = "mysql"`. Vitest for tests. Strict TypeScript everywhere.

**Tech Stack:** npm · Node 20 LTS · Next.js 15 · TypeScript 5 strict · Tailwind 3 · shadcn/ui · Prisma 5 · MariaDB 11 · Vitest 1.x

---

## Acceptance criteria → tasks map

| Master AC (Stage 1) | Tasks |
|---|---|
| 1. Monorepo structure with workspaces | T1, T2 |
| 2. `.env` credentials for existing MariaDB | T3 |
| 3. Prisma schema with all v1 models + initial migration | T4, T5, T6 |
| 4. Next.js 15 + Tailwind + shadcn/ui | T7, T8, T9 |
| 5. Routes `/` and `/projects` return 200 | T10, T11, T12 |
| 6. README with setup steps | T15 |

---

## File structure to create

```
open-effects/
├── .editorconfig
├── .gitignore
├── .nvmrc                            # 20
├── .env.example
├── README.md
├── package.json                      # workspaces root
├── tsconfig.base.json                # shared strict config
├── apps/
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── postcss.config.mjs
│       ├── components.json           # shadcn/ui config
│       ├── vitest.config.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       │       └── 0001_init/
│       │           └── migration.sql
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx          # landing /
│       │   │   ├── globals.css
│       │   │   ├── projects/
│       │   │   │   └── page.tsx      # empty list
│       │   │   └── api/
│       │   │       └── projects/
│       │   │           └── route.ts  # GET returns []
│       │   ├── lib/
│       │   │   ├── db.ts             # PrismaClient singleton
│       │   │   └── utils.ts          # shadcn cn() helper
│       │   └── components/
│       │       └── ui/               # shadcn primitives (button, card)
│       └── tests/
│           ├── db.test.ts            # Prisma connection smoke
│           └── api/
│               └── projects.test.ts  # GET /api/projects → []
└── packages/
    ├── runtime/
    │   ├── package.json              # skeleton, no impl
    │   └── tsconfig.json
    └── shared-types/
        ├── package.json              # skeleton, no impl
        ├── tsconfig.json
        └── src/index.ts              # placeholder export {}
```

---

## Task list (execution order)

### Task 1: Initialize git + repo skeleton

**Files:**
- Create: `.gitignore`, `.editorconfig`, `.nvmrc`, `tsconfig.base.json`, `README.md` (placeholder)

- [ ] **Step 1:** `cd /home/farena/workspace/open-effects && git init`
- [ ] **Step 2:** Write `.gitignore` covering `node_modules/`, `.next/`, `dist/`, `.env`, `.env.local`, `*.log`, `.cache/`, `apps/web/public/assets/*` (ignore uploads), `apps/web/public/renders/*`, `coverage/`.
- [ ] **Step 3:** Write `.nvmrc` containing `20`.
- [ ] **Step 4:** Write `.editorconfig` with `indent_size=2`, `end_of_line=lf`, `charset=utf-8`, `trim_trailing_whitespace=true`, `insert_final_newline=true`.
- [ ] **Step 5:** Write `tsconfig.base.json` with `"strict": true`, `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"esModuleInterop": true`, `"skipLibCheck": true`, `"forceConsistentCasingInFileNames": true`, `"resolveJsonModule": true`, `"isolatedModules": true`, `"noEmit": true`.
- [ ] **Step 6:** `git add -A && git commit -m "chore: repo skeleton"`

**Validation:** `git log --oneline` shows the initial commit.

---

### Task 2: Configure npm workspaces

**Files:**
- Create: `package.json`

- [ ] **Step 1:** Write root `package.json`:
  ```json
  {
    "name": "open-effects",
    "private": true,
    "engines": { "node": ">=20.0.0" },
    "workspaces": ["apps/*", "packages/*"],
    "scripts": {
      "dev": "npm run dev -w apps/web",
      "build": "npm run build --workspaces",
      "test": "npm run test --workspaces",
      "db:migrate": "npm run db:migrate -w apps/web",
      "db:studio": "npm run db:studio -w apps/web",
      "db:generate": "npm run db:generate -w apps/web"
    }
  }
  ```
- [ ] **Step 2:** Run `npm install` from root (creates `package-lock.json` even if empty).
- [ ] **Step 3:** Commit: `chore: npm workspaces`.

**Validation:** `npm run --workspaces ls 2>/dev/null; echo OK` runs without error.

---

### Task 3: Environment setup (.env)

**Files:**
- Create: `.env.example`, `.env` (local, gitignored)

- [ ] **Step 1:** Write `.env.example` with the credentials needed to connect to the existing MariaDB container:
  ```
  DB_NAME=open_effects
  DB_USER=open_effects
  DB_PASSWORD=open_effects_pw
  DB_PORT=3306
  DATABASE_URL=mysql://open_effects:open_effects_pw@127.0.0.1:3306/open_effects
  ```
- [ ] **Step 2:** Copy `.env.example` to `.env` locally and fill in the real credentials for the running container.
- [ ] **Step 3:** Verify connection: `mariadb -u open_effects -p<password> -h 127.0.0.1 -P 3306 -e "SHOW DATABASES;"` lists `open_effects`.
- [ ] **Step 4:** Commit: `chore: env example`.

---

### Task 4: Scaffold `apps/web` with Next.js 15

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.mjs`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`

- [ ] **Step 1:** Manually scaffold (avoid `create-next-app` interactive prompts in monorepo). Write `apps/web/package.json`:
  ```json
  {
    "name": "web",
    "version": "0.1.0",
    "private": true,
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "test": "vitest run",
      "test:watch": "vitest",
      "typecheck": "tsc --noEmit"
    },
    "dependencies": {
      "next": "15.0.3",
      "react": "19.0.0",
      "react-dom": "19.0.0"
    },
    "devDependencies": {
      "@types/node": "20",
      "@types/react": "19",
      "@types/react-dom": "19",
      "typescript": "5.6.3"
    }
  }
  ```
- [ ] **Step 2:** Write `apps/web/tsconfig.json` extending `tsconfig.base.json`:
  ```json
  {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
      "lib": ["dom", "dom.iterable", "esnext"],
      "jsx": "preserve",
      "incremental": true,
      "plugins": [{ "name": "next" }],
      "paths": { "@/*": ["./src/*"] }
    },
    "include": ["next-env.d.ts", "src/**/*", "tests/**/*", ".next/types/**/*.ts"],
    "exclude": ["node_modules"]
  }
  ```
- [ ] **Step 3:** Write `apps/web/next.config.mjs`:
  ```js
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@open-effects/runtime", "@open-effects/shared-types"]
  };
  export default nextConfig;
  ```
- [ ] **Step 4:** Write minimal `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (empty).
- [ ] **Step 5:** `npm install` from root.
- [ ] **Step 6:** `npm run dev` → open `http://localhost:3000` → verify Next.js default page renders.
- [ ] **Step 7:** Commit: `feat(web): scaffold next.js 15`.

**Validation:** `curl -s http://localhost:3000 | grep -i 'open-effects\|next'` returns content.

---

### Task 5: Add Tailwind CSS

**Files:**
- Create: `apps/web/tailwind.config.ts`, `apps/web/postcss.config.mjs`
- Modify: `apps/web/package.json` (deps), `apps/web/src/app/globals.css`

- [ ] **Step 1:** Add deps: `npm install -D tailwindcss@3 postcss autoprefixer -w apps/web`.
- [ ] **Step 2:** Write `tailwind.config.ts`:
  ```ts
  import type { Config } from "tailwindcss";
  export default {
    content: ["./src/**/*.{ts,tsx}"],
    theme: { extend: {} },
    plugins: []
  } satisfies Config;
  ```
- [ ] **Step 3:** Write `postcss.config.mjs`:
  ```js
  export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
  ```
- [ ] **Step 4:** Replace `globals.css` with Tailwind layers:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
- [ ] **Step 5:** Apply a Tailwind class on `app/page.tsx` (e.g., `<main className="p-8 text-2xl">open-effects</main>`).
- [ ] **Step 6:** `npm run dev` → confirm class applies (large padded heading).
- [ ] **Step 7:** Commit: `feat(web): tailwind`.

---

### Task 6: Add shadcn/ui base + utility helper

**Files:**
- Create: `apps/web/components.json`, `apps/web/src/lib/utils.ts`, `apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/tailwind.config.ts` (add shadcn theme extension)

- [ ] **Step 1:** Add deps: `npm install class-variance-authority clsx tailwind-merge lucide-react -w apps/web && npm install -D @types/node -w apps/web`.
- [ ] **Step 2:** Write `src/lib/utils.ts`:
  ```ts
  import { clsx, type ClassValue } from "clsx";
  import { twMerge } from "tailwind-merge";
  export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
  ```
- [ ] **Step 3:** Write `components.json` with the standard shadcn config (style: default, baseColor: zinc, cssVariables: true).
- [ ] **Step 4:** Manually copy/write the two primitives (button, card). Source from shadcn docs (https://ui.shadcn.com/docs/components/button, /card) — these are stable, don't rely on the CLI in a monorepo.
- [ ] **Step 5:** Update `tailwind.config.ts` to include shadcn theme tokens (colors via CSS variables); update `globals.css` to declare `:root` and `.dark` CSS variables (copy from shadcn theme template).
- [ ] **Step 6:** Render a `<Button>` on the landing page; verify it styles correctly.
- [ ] **Step 7:** Commit: `feat(web): shadcn/ui base`.

---

### Task 7: Skeleton packages (`runtime`, `shared-types`)

**Files:**
- Create: `packages/runtime/package.json`, `packages/runtime/tsconfig.json`, `packages/runtime/src/index.ts`
- Create: `packages/shared-types/package.json`, `packages/shared-types/tsconfig.json`, `packages/shared-types/src/index.ts`

- [ ] **Step 1:** Write `packages/shared-types/package.json`:
  ```json
  {
    "name": "@open-effects/shared-types",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "scripts": { "typecheck": "tsc --noEmit" },
    "devDependencies": { "typescript": "5.6.3" }
  }
  ```
- [ ] **Step 2:** Write `packages/shared-types/tsconfig.json` extending base.
- [ ] **Step 3:** Write `packages/shared-types/src/index.ts`: `export {};` (placeholder; real schemas land in Stage 2).
- [ ] **Step 4:** Mirror for `packages/runtime/package.json` (name `@open-effects/runtime`, same shape).
- [ ] **Step 5:** Add a stub `packages/runtime/src/index.ts`: `export {};`
- [ ] **Step 6:** From root: `npm install` to link workspace packages.
- [ ] **Step 7:** Commit: `chore: skeleton packages runtime + shared-types`.

**Note:** real implementation arrives in Stage 2. We create the skeletons now so workspace resolution works and `next.config.mjs` `transpilePackages` is valid.

---

### Task 8: Install Prisma + define complete v1 schema

**Files:**
- Create: `apps/web/prisma/schema.prisma`, `apps/web/src/lib/db.ts`
- Modify: `apps/web/package.json` (deps)

- [ ] **Step 1:** Add deps: `npm install @prisma/client -w apps/web && npm install -D prisma -w apps/web`.
- [ ] **Step 2:** Write `apps/web/prisma/schema.prisma`:
  ```prisma
  generator client {
    provider = "prisma-client-js"
  }

  datasource db {
    provider = "mysql"
    url      = env("DATABASE_URL")
  }

  model Project {
    id        String   @id @default(cuid())
    name      String
    width     Int
    height    Int
    fps       Int      @default(30)
    scenes    Scene[]
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }

  model Scene {
    id             String       @id @default(cuid())
    project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
    projectId      String
    order          Int
    durationFrames Int
    transitionIn   Json?
    layers         Layer[]
    audioTracks    AudioTrack[]
    @@index([projectId])
  }

  model Layer {
    id         String     @id @default(cuid())
    scene      Scene      @relation(fields: [sceneId], references: [id], onDelete: Cascade)
    sceneId    String
    order      Int
    name       String
    html       String     @db.Text
    css        String     @db.Text
    startFrame Int        @default(0)
    endFrame   Int
    keyframes  Keyframe[]
    @@index([sceneId])
  }

  model Keyframe {
    id        String @id @default(cuid())
    layer     Layer  @relation(fields: [layerId], references: [id], onDelete: Cascade)
    layerId   String
    frame     Int
    property  String
    value     String @db.Text
    easingOut Json
    @@index([layerId, property, frame])
  }

  model AudioTrack {
    id              String           @id @default(cuid())
    scene           Scene            @relation(fields: [sceneId], references: [id], onDelete: Cascade)
    sceneId         String
    asset           Asset            @relation(fields: [assetId], references: [id])
    assetId         String
    startFrame      Int
    trimStart       Int              @default(0)
    trimEnd         Int
    eq              Json?
    volumeKeyframes VolumeKeyframe[]
    @@index([sceneId])
  }

  model VolumeKeyframe {
    id           String     @id @default(cuid())
    audioTrack   AudioTrack @relation(fields: [audioTrackId], references: [id], onDelete: Cascade)
    audioTrackId String
    frame        Int
    value        Float
    easingOut    Json
    @@index([audioTrackId, frame])
  }

  model Asset {
    id          String       @id @default(cuid())
    type        String       // "image" | "audio" | "video" | "font"
    filename    String
    path        String
    mimeType    String
    size        Int
    sha256      String       @unique
    createdAt   DateTime     @default(now())
    audioTracks AudioTrack[]
    @@index([type])
  }

  model SavedComponent {
    id        String   @id @default(cuid())
    name      String
    category  String?
    preview   String?
    payload   Json
    createdAt DateTime @default(now())
    @@index([category])
  }
  ```
- [ ] **Step 3:** Write `src/lib/db.ts`:
  ```ts
  import { PrismaClient } from "@prisma/client";
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
  export const db = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
  ```
- [ ] **Step 4:** Run `npm run db:migrate --name init` (interactive name `init`). Verify a migration file appears under `apps/web/prisma/migrations/0001_init/`.
- [ ] **Step 5:** Verify with `mariadb -u open_effects -p<password> -h 127.0.0.1 open_effects -e "SHOW TABLES;"` — should list 8 tables.
- [ ] **Step 6:** Commit: `feat(db): prisma schema + initial migration`.

---

### Task 9: Vitest setup + Prisma connection smoke test (TDD)

**Files:**
- Create: `apps/web/vitest.config.ts`, `apps/web/tests/db.test.ts`
- Modify: `apps/web/package.json` (deps)

- [ ] **Step 1:** Add deps: `npm install -D vitest @vitest/ui dotenv -w apps/web`.
- [ ] **Step 2:** Write `vitest.config.ts`:
  ```ts
  import { defineConfig } from "vitest/config";
  import path from "node:path";
  export default defineConfig({
    test: {
      environment: "node",
      setupFiles: ["dotenv/config"],
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") }
    }
  });
  ```
- [ ] **Step 3:** Write failing test `tests/db.test.ts`:
  ```ts
  import { describe, it, expect, afterAll } from "vitest";
  import { db } from "@/lib/db";

  describe("Prisma client", () => {
    afterAll(async () => { await db.$disconnect(); });
    it("connects to MariaDB", async () => {
      const result = await db.$queryRawUnsafe<[{ ok: number }]>("SELECT 1 as ok");
      expect(result[0].ok).toBe(1);
    });
  });
  ```
- [ ] **Step 4:** Run `npm run test -w apps/web` → confirms it passes (DB is up from Task 3).
- [ ] **Step 5:** Commit: `test(db): prisma connection smoke`.

**Failure mode:** if test fails with `ECONNREFUSED`, ensure the MariaDB container is running and `.env` is being loaded (`dotenv/config` setup file).

---

### Task 10: API route `GET /api/projects` returning empty list (TDD)

**Files:**
- Create: `apps/web/src/app/api/projects/route.ts`, `apps/web/tests/api/projects.test.ts`

- [ ] **Step 1:** Write failing test `tests/api/projects.test.ts`:
  ```ts
  import { describe, it, expect, afterAll } from "vitest";
  import { GET } from "@/app/api/projects/route";
  import { db } from "@/lib/db";

  describe("GET /api/projects", () => {
    afterAll(async () => { await db.$disconnect(); });
    it("returns an empty array when DB is empty", async () => {
      await db.project.deleteMany();
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });
  });
  ```
- [ ] **Step 2:** Run test, confirm fail (route doesn't exist).
- [ ] **Step 3:** Implement minimal route `app/api/projects/route.ts`:
  ```ts
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  export async function GET() {
    const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
    return NextResponse.json(projects);
  }
  ```
- [ ] **Step 4:** Run test, confirm pass.
- [ ] **Step 5:** Manual check: `curl -s http://localhost:3000/api/projects` → `[]`.
- [ ] **Step 6:** Commit: `feat(api): GET /api/projects`.

---

### Task 11: Landing page `/`

**Files:**
- Modify: `apps/web/src/app/page.tsx`, `apps/web/src/app/layout.tsx`

- [ ] **Step 1:** Write `app/layout.tsx` with HTML shell, metadata `{ title: "open-effects" }`, and `<body>` applying `globals.css`.
- [ ] **Step 2:** Write `app/page.tsx`:
  ```tsx
  import Link from "next/link";
  import { Button } from "@/components/ui/button";
  export default function Home() {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-4xl font-bold tracking-tight">open-effects</h1>
        <p className="text-muted-foreground">Visual video editor over Remotion.</p>
        <Button asChild><Link href="/projects">Go to projects</Link></Button>
      </main>
    );
  }
  ```
- [ ] **Step 3:** Visual verification at `http://localhost:3000`.
- [ ] **Step 4:** Commit: `feat(web): landing page`.

---

### Task 12: Projects list page `/projects` (empty state)

**Files:**
- Create: `apps/web/src/app/projects/page.tsx`

- [ ] **Step 1:** Write `app/projects/page.tsx` (Server Component, fetches from `db` directly):
  ```tsx
  import Link from "next/link";
  import { db } from "@/lib/db";
  import { Button } from "@/components/ui/button";
  import { Card } from "@/components/ui/card";

  export const dynamic = "force-dynamic";

  export default async function ProjectsPage() {
    const projects = await db.project.findMany({ orderBy: { updatedAt: "desc" } });
    return (
      <main className="container mx-auto p-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Projects</h1>
          <Button disabled title="New project (Stage 3)">+ New project</Button>
        </header>
        {projects.length === 0 ? (
          <Card className="mt-8 p-12 text-center text-muted-foreground">
            No projects yet. Stage 3 will enable creation.
          </Card>
        ) : (
          <ul className="mt-8 grid grid-cols-3 gap-4">
            {projects.map((p) => (
              <li key={p.id}><Card className="p-4">{p.name}</Card></li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/" className="underline">← Home</Link>
        </p>
      </main>
    );
  }
  ```
- [ ] **Step 2:** Visual check at `http://localhost:3000/projects` → renders empty state with disabled "New project" button.
- [ ] **Step 3:** Commit: `feat(web): projects list page (empty state)`.

---

### Task 13: Typecheck + lint baseline

**Files:**
- Create: `apps/web/.eslintrc.json` (or `eslint.config.mjs`)
- Modify: `apps/web/package.json` (scripts + deps)

- [ ] **Step 1:** Add `npm install -D eslint eslint-config-next -w apps/web`.
- [ ] **Step 2:** Write `apps/web/.eslintrc.json`:
  ```json
  { "extends": ["next/core-web-vitals", "next/typescript"] }
  ```
- [ ] **Step 3:** Add scripts to `apps/web/package.json`: `"lint": "next lint"`.
- [ ] **Step 4:** Run `npm run typecheck -w apps/web` → must pass.
- [ ] **Step 5:** Run `npm run lint -w apps/web` → must pass (fix any warnings).
- [ ] **Step 6:** Commit: `chore: eslint + typecheck baseline`.

---

### Task 14: Health endpoint + smoke test (CI signal)

**Files:**
- Create: `apps/web/src/app/api/health/route.ts`, `apps/web/tests/api/health.test.ts`

- [ ] **Step 1:** Write failing test `tests/api/health.test.ts`:
  ```ts
  import { describe, it, expect, afterAll } from "vitest";
  import { GET } from "@/app/api/health/route";
  import { db } from "@/lib/db";

  describe("GET /api/health", () => {
    afterAll(async () => { await db.$disconnect(); });
    it("returns ok when DB is reachable", async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: "ok", db: "up" });
    });
  });
  ```
- [ ] **Step 2:** Run test, confirm fail.
- [ ] **Step 3:** Implement `app/api/health/route.ts`:
  ```ts
  import { NextResponse } from "next/server";
  import { db } from "@/lib/db";
  export async function GET() {
    try {
      await db.$queryRawUnsafe("SELECT 1");
      return NextResponse.json({ status: "ok", db: "up" });
    } catch {
      return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
    }
  }
  ```
- [ ] **Step 4:** Run test, confirm pass.
- [ ] **Step 5:** Commit: `feat(api): health endpoint`.

---

### Task 15: README and final polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Write `README.md` covering:
  - **Prerequisites**: Node 20+, npm 10+, MariaDB 11 running (existing container), FFmpeg (note: only used from Stage 6, but list it now).
  - **Quickstart**:
    ```sh
    cp .env.example .env
    # edit .env with your MariaDB credentials
    npm install
    npm run db:migrate
    npm run dev
    ```
  - **Common scripts**: `npm run dev`, `npm test`, `npm run db:studio`, `npm run db:migrate`.
  - **Project structure** (mirrors the file tree above).
  - **Stage status**: link to `docs/plans/00-master-plan.md`; Stage 1 = ✅.
  - **Smoke test**: `curl localhost:3000/api/health` → `{"status":"ok","db":"up"}`.
- [ ] **Step 2:** Commit: `docs: README quickstart and stage 1 status`.

---

### Task 16: Stage closure verification

- [ ] **Step 1:** From a clean state: `rm -rf node_modules apps/web/node_modules packages/*/node_modules`.
- [ ] **Step 2:** Run the Quickstart from README verbatim. Time it — must be under 10 minutes.
- [ ] **Step 3:** Verify all of:
  - `curl http://localhost:3000` → 200, contains "open-effects"
  - `curl http://localhost:3000/projects` → 200, contains "No projects yet"
  - `curl http://localhost:3000/api/projects` → `[]`
  - `curl http://localhost:3000/api/health` → `{"status":"ok","db":"up"}`
  - `npm test` → all green
  - `npm run typecheck -w apps/web` → clean
  - `npm run lint -w apps/web` → clean
- [ ] **Step 4:** Tag closure commit: `git commit -m "STAGE-1: closed"` (or merge stage branch).

---

## Test summary

| Test | Type | File |
|---|---|---|
| Prisma connects to MariaDB | unit (smoke) | `tests/db.test.ts` |
| `GET /api/projects` returns `[]` | integration | `tests/api/projects.test.ts` |
| `GET /api/health` returns `{status:"ok"}` | integration | `tests/api/health.test.ts` |
| Cold-clone setup under 10 min | manual | README quickstart |
| `/` and `/projects` render | manual | browser |

---

## Risks specific to Stage 1

| Risk | Mitigation |
|---|---|
| MariaDB container port collision (3306 in use locally) | `.env` exposes `DB_PORT`; document override in README. |
| Prisma `mysql` provider quirks with `Json` columns on MariaDB < 10.2.7 | Pinned to MariaDB 11; verified `Json` type works. |
| shadcn CLI fails in monorepo | Manual copy of primitives from official source — documented in Task 6. |
| `transpilePackages` may not pick up workspace packages | Task 7 sets up real workspace links; verified in Task 4 step 5. |
| Vitest can't import `@/lib/db` | Vitest config aliases `@` to `src/` (Task 9 step 2). |

---

## Handoff to Stage 2

Stage 2 (`02-runtime-engine.md`) will:
- Replace `packages/shared-types/src/index.ts` placeholder with Zod schemas for `ProjectJson`, `SceneJson`, `LayerJson`, `KeyframeJson`, `AudioTrackJson`, `VolumeKeyframeJson`.
- Replace `packages/runtime/src/index.ts` placeholder with `OpenEffectsComposition`, `Layer`, fixtures, and Remotion config.
- Add `@remotion/*` deps to `packages/runtime`.
- Add `npm run studio -w packages/runtime` script.

No DB changes in Stage 2 — schema is fixed.

---

## Final task checklist (execution order)

- [ ] T1 — Repo skeleton
- [ ] T2 — npm workspaces
- [ ] T3 — Environment setup (.env)
- [ ] T4 — Next.js 15 scaffold
- [ ] T5 — Tailwind
- [ ] T6 — shadcn/ui base
- [ ] T7 — Skeleton packages (runtime, shared-types)
- [ ] T8 — Prisma schema + initial migration
- [ ] T9 — Vitest + DB connection smoke test
- [ ] T10 — `GET /api/projects` (TDD)
- [ ] T11 — Landing `/`
- [ ] T12 — `/projects` empty state
- [ ] T13 — ESLint + typecheck baseline
- [ ] T14 — Health endpoint (TDD)
- [ ] T15 — README
- [ ] T16 — Stage closure verification

**Total tasks:** 16 · **Estimate:** 1 week · **Critical risks:** none blocking; shadcn manual copy is the most fiddly step.
