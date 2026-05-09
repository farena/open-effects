"use client";

import { useEffect, useState, useCallback } from "react";
import { BusinessContextView } from "@/components/business-context/BusinessContextView";
import { BusinessContextChat } from "@/components/business-context/BusinessContextChat";
import type { BusinessContext } from "@open-effects/shared-types";
import { DEFAULT_BUSINESS_CONTEXT } from "@open-effects/shared-types";

export default function BusinessContextPage() {
  const [context, setContext] = useState<BusinessContext>(DEFAULT_BUSINESS_CONTEXT);
  const [claudeAvailable, setClaudeAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch("/api/business-context");
      if (res.ok) {
        const data: BusinessContext = await res.json();
        setContext(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContext();
    void fetch("/api/chat/health")
      .then((r) => r.json())
      .then((d: { claudeAvailable: boolean }) =>
        setClaudeAvailable(!!d.claudeAvailable),
      )
      .catch(() => setClaudeAvailable(false));
  }, [loadContext]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-screen max-h-screen flex overflow-hidden">
      <main className="flex-1 min-w-0 h-full overflow-hidden">
        <BusinessContextView
          context={context}
          onSaved={setContext}
          onReload={loadContext}
        />
      </main>
      <aside className="hidden md:flex md:flex-col w-[400px] h-full max-h-screen border-l border-border bg-background overflow-hidden">
        <BusinessContextChat
          claudeAvailable={claudeAvailable}
          onContextUpdated={loadContext}
        />
      </aside>
    </div>
  );
}
