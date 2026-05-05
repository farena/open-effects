"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScenesPanel } from "./ScenesPanel";
import { LayersPanel } from "./LayersPanel";

export function Sidebar() {
  return (
    <div className="h-full flex flex-col bg-muted/40">
      <Tabs defaultValue="scenes" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full rounded-none border-b bg-transparent h-9 shrink-0">
          <TabsTrigger value="scenes" className="flex-1">
            Scenes
          </TabsTrigger>
          <TabsTrigger value="layers" className="flex-1">
            Layers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenes" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <ScenesPanel />
        </TabsContent>

        <TabsContent value="layers" className="flex-1 min-h-0 mt-0 overflow-hidden">
          <LayersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
