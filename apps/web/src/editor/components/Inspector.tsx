"use client";

import { useEditorStore } from "@/editor/store";
import { selectActiveLayer } from "@/editor/selectors";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { PropsTab } from "./inspector/PropsTab";
import { HtmlTab } from "./inspector/HtmlTab";
import { CssTab } from "./inspector/CssTab";

export function Inspector() {
  const layer = useEditorStore(selectActiveLayer);

  if (!layer) {
    return (
      <div className="p-4 text-sm text-muted-foreground">Select a layer</div>
    );
  }

  return (
    <Tabs
      key={layer.id}
      defaultValue="props"
      className="h-full w-full flex flex-col"
    >
      <TabsList className="mx-2 mt-2 shrink-0">
        <TabsTrigger value="props">Props</TabsTrigger>
        <TabsTrigger value="html">HTML</TabsTrigger>
        <TabsTrigger value="css">CSS</TabsTrigger>
      </TabsList>

      <TabsContent value="props" className="flex-1 overflow-y-auto mt-0">
        <PropsTab />
      </TabsContent>

      <TabsContent value="html" className="flex-1 min-h-0 flex flex-col mt-0">
        <HtmlTab />
      </TabsContent>

      <TabsContent value="css" className="flex-1 min-h-0 flex flex-col mt-0">
        <CssTab />
      </TabsContent>
    </Tabs>
  );
}
