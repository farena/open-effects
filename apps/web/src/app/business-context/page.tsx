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
    <div className="h-screen grid grid-cols-1 md:grid-cols-[1fr_400px]">
      <BusinessContextView
        context={context}
        onSaved={setContext}
        onReload={loadContext}
      />
      <div className="border-l border-border bg-background hidden md:flex md:flex-col">
        <BusinessContextChat
          claudeAvailable={claudeAvailable}
          onContextUpdated={loadContext}
        />
      </div>
    </div>
  );
}
