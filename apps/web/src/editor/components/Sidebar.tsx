"use client";

import {
  Film,
  Layers as LayersIcon,
  Image as ImageIcon,
  Boxes,
  FileText,
  Code2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScenesPanel } from "./ScenesPanel";
import { LayersPanel } from "./LayersPanel";
import { AssetsPanel } from "./AssetsPanel";
import { ComponentsPanel } from "./ComponentsPanel";
import { VideoScriptPanel } from "./VideoScriptPanel";
import { ProjectCssPanel } from "./ProjectCssPanel";

const TAB_ITEMS = [
  { value: "scenes", label: "Scenes", Icon: Film },
  { value: "layers", label: "Layers", Icon: LayersIcon },
  { value: "assets", label: "Assets", Icon: ImageIcon },
  { value: "components", label: "Components", Icon: Boxes },
  { value: "script", label: "Video script", Icon: FileText },
  { value: "project-css", label: "Project CSS", Icon: Code2 },
] as const;

export function Sidebar() {
  return (
    <div className="flex h-full bg-muted/40">
      <Tabs
        defaultValue="scenes"
        orientation="vertical"
        className="flex h-full w-full"
      >
        <TooltipProvider delayDuration={300}>
          {/* Vertical icon-only rail */}
          <TabsList className="flex h-full w-10 shrink-0 flex-col items-center justify-start gap-0 rounded-none border-r bg-muted/40 p-0 py-2">
            {TAB_ITEMS.map(({ value, label, Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value={value}
                    className="flex h-8 w-8 items-center justify-center rounded-sm p-0 data-[state=active]:bg-accent data-[state=active]:border-l-2 data-[state=active]:border-primary"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ))}
          </TabsList>
        </TooltipProvider>

        {/* Panel content */}
        <div className="flex-1 min-w-0">
          <TabsContent value="scenes" className="h-full overflow-hidden mt-0">
            <ScenesPanel />
          </TabsContent>
          <TabsContent value="layers" className="h-full overflow-hidden mt-0">
            <LayersPanel />
          </TabsContent>
          <TabsContent value="assets" className="h-full overflow-hidden mt-0">
            <AssetsPanel />
          </TabsContent>
          <TabsContent value="components" className="h-full overflow-hidden mt-0">
            <ComponentsPanel />
          </TabsContent>
          <TabsContent value="script" className="h-full overflow-hidden mt-0">
            <VideoScriptPanel />
          </TabsContent>
          <TabsContent
            value="project-css"
            className="h-full overflow-hidden mt-0"
          >
            <ProjectCssPanel />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
