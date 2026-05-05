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
