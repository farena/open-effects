"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScenesPanel } from "./ScenesPanel";
import { LayersPanel } from "./LayersPanel";
import { AssetsPanel } from "./AssetsPanel";
import { ComponentsPanel } from "./ComponentsPanel";

export function Sidebar() {
  return (
    <div className="flex h-full flex-col bg-muted/40">
      <Tabs defaultValue="scenes" className="flex flex-col h-full">
        <TabsList className="mx-2 mt-2 shrink-0">
          <TabsTrigger value="scenes" className="flex-1">
            Scenes
          </TabsTrigger>
          <TabsTrigger value="layers" className="flex-1">
            Layers
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex-1">
            Assets
          </TabsTrigger>
          <TabsTrigger value="components" className="flex-1">
            Components
          </TabsTrigger>
        </TabsList>
        <TabsContent value="scenes" className="flex-1 overflow-hidden mt-0">
          <ScenesPanel />
        </TabsContent>
        <TabsContent value="layers" className="flex-1 overflow-hidden mt-0">
          <LayersPanel />
        </TabsContent>
        <TabsContent value="assets" className="flex-1 overflow-hidden mt-0">
          <AssetsPanel />
        </TabsContent>
        <TabsContent value="components" className="flex-1 overflow-hidden mt-0">
          <ComponentsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
