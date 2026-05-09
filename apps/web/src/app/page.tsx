import Link from "next/link";
import { Building2, Clapperboard, FolderKanban } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Clapperboard className="h-6 w-6 text-primary" />
          <span className="text-base font-bold tracking-tight">
            open-effects
          </span>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/business-context"
            className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Business context
          </Link>
          <Link
            href="/projects"
            className="px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Projects
          </Link>
        </nav>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <Clapperboard className="h-14 w-14 text-primary" />
          <h1 className="text-5xl font-bold tracking-tight">open-effects</h1>
          <p className="text-muted-foreground">
            Visual video editor over Remotion.
          </p>
        </div>

        <nav className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <Link
            href="/business-context"
            className="rounded-xl border border-border bg-card p-6 hover:border-primary hover:bg-accent/40 transition-colors"
          >
            <Building2 className="h-8 w-8 mb-3 text-primary" />
            <h2 className="text-lg font-semibold mb-1">Business context</h2>
            <p className="text-sm text-muted-foreground">
              Brand memory injected into every project chat.
            </p>
          </Link>
          <Link
            href="/projects"
            className="rounded-xl border border-border bg-card p-6 hover:border-primary hover:bg-accent/40 transition-colors"
          >
            <FolderKanban className="h-8 w-8 mb-3 text-primary" />
            <h2 className="text-lg font-semibold mb-1">Projects</h2>
            <p className="text-sm text-muted-foreground">
              Manage your videos, scenes, layers, and audio.
            </p>
          </Link>
        </nav>
      </div>
    </main>
  );
}
