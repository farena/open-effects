"use client";

import { useEditorStore } from "@/editor/store";
import {
  selectActiveLayer,
  selectActiveScene,
  selectActiveAudioTrack,
} from "@/editor/selectors";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PropsTab } from "./inspector/PropsTab";
import { HtmlTab } from "./inspector/HtmlTab";
import { CssTab } from "./inspector/CssTab";
import { KeyframesTab } from "./inspector/KeyframesTab";
import { SceneTab } from "./inspector/SceneTab";
import { TransitionTab } from "./inspector/TransitionTab";
import { AudioFxTab } from "./inspector/AudioFxTab";

export function Inspector() {
  const audioTrack = useEditorStore(selectActiveAudioTrack);
  const layer = useEditorStore(selectActiveLayer);
  const scene = useEditorStore(selectActiveScene);

  if (audioTrack) {
    return <AudioFxTab />;
  }

  if (layer) {
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
          <TabsTrigger value="keyframes">Keyframes</TabsTrigger>
        </TabsList>

        <TabsContent
          value="props"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <PropsTab />
        </TabsContent>

        <TabsContent value="html" className="mt-0 flex min-h-0 flex-1 flex-col">
          <HtmlTab />
        </TabsContent>

        <TabsContent value="css" className="mt-0 flex min-h-0 flex-1 flex-col">
          <CssTab />
        </TabsContent>

        <TabsContent
          value="keyframes"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <KeyframesTab />
        </TabsContent>
      </Tabs>
    );
  }

  if (scene) {
    return (
      <Tabs
        key={scene.id}
        defaultValue="scene"
        className="h-full w-full flex flex-col"
      >
        <TabsList className="mx-2 mt-2 shrink-0">
          <TabsTrigger value="scene">Scene</TabsTrigger>
          <TabsTrigger value="transition">Transition</TabsTrigger>
          <TabsTrigger value="keyframes">Keyframes</TabsTrigger>
        </TabsList>

        <TabsContent
          value="scene"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <SceneTab />
        </TabsContent>

        <TabsContent
          value="transition"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <TransitionTab />
        </TabsContent>

        <TabsContent
          value="keyframes"
          className="mt-0 flex min-h-0 flex-1 flex-col"
        >
          <KeyframesTab />
        </TabsContent>
      </Tabs>
    );
  }

  return (
    <div className="p-4 text-sm text-muted-foreground">
      Select a scene, layer, or audio track.
    </div>
  );
}
