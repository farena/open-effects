"use client";

import {
  Sliders,
  Code2,
  Paintbrush,
  Diamond,
  Film,
  ArrowRightLeft,
  Music,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useEditorStore } from "@/editor/store";
import {
  selectActiveLayer,
  selectActiveScene,
  selectActiveAudioTrack,
} from "@/editor/selectors";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PropsTab } from "./inspector/PropsTab";
import { HtmlTab } from "./inspector/HtmlTab";
import { CssTab } from "./inspector/CssTab";
import { KeyframesTab } from "./inspector/KeyframesTab";
import { PresetsTab } from "./inspector/PresetsTab";
import { SceneTab } from "./inspector/SceneTab";
import { TransitionTab } from "./inspector/TransitionTab";
import { AudioFxTab } from "./inspector/AudioFxTab";

interface TabItem {
  value: string;
  label: string;
  Icon: LucideIcon;
}

interface VerticalIconTabsProps {
  defaultValue: string;
  tabKey: string;
  items: readonly TabItem[];
  contents: Record<string, React.ReactNode>;
}

/**
 * Right-side icon rail mirror of `Sidebar.tsx`. Tabs sit vertically on the
 * right edge of the inspector with a tooltip per item; content takes the
 * remaining horizontal space on the left.
 */
function VerticalIconTabs({
  defaultValue,
  tabKey,
  items,
  contents,
}: VerticalIconTabsProps) {
  return (
    <div className="flex h-full bg-muted/40">
      <Tabs
        key={tabKey}
        defaultValue={defaultValue}
        orientation="vertical"
        className="flex h-full w-full"
      >
        {/* Panel content (left) — takes remaining width */}
        <div className="min-w-0 flex-1">
          {items.map(({ value }) => (
            <TabsContent
              key={value}
              value={value}
              className="mt-0 flex h-full min-h-0 flex-col overflow-hidden"
            >
              {contents[value]}
            </TabsContent>
          ))}
        </div>

        <TooltipProvider delayDuration={300}>
          {/* Vertical icon-only rail (right edge) */}
          <TabsList className="flex h-full w-10 shrink-0 flex-col items-center justify-start gap-0 rounded-none border-l bg-muted/40 p-0 py-2">
            {items.map(({ value, label, Icon }) => (
              <Tooltip key={value}>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value={value}
                    className="flex h-8 w-8 items-center justify-center rounded-sm p-0 data-[state=active]:bg-accent data-[state=active]:border-r-2 data-[state=active]:border-primary"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent side="left">{label}</TooltipContent>
              </Tooltip>
            ))}
          </TabsList>
        </TooltipProvider>
      </Tabs>
    </div>
  );
}

const LAYER_TABS: readonly TabItem[] = [
  { value: "props", label: "Props", Icon: Sliders },
  { value: "html", label: "HTML", Icon: Code2 },
  { value: "css", label: "CSS", Icon: Paintbrush },
  { value: "keyframes", label: "Keyframes", Icon: Diamond },
  { value: "presets", label: "Presets", Icon: Sparkles },
];

const SCENE_TABS: readonly TabItem[] = [
  { value: "scene", label: "Scene", Icon: Film },
  { value: "transition", label: "Transition", Icon: ArrowRightLeft },
  { value: "keyframes", label: "Keyframes", Icon: Diamond },
];

const AUDIO_TABS: readonly TabItem[] = [
  { value: "audio-fx", label: "Audio FX", Icon: Music },
];

export function Inspector() {
  const audioTrack = useEditorStore(selectActiveAudioTrack);
  const layer = useEditorStore(selectActiveLayer);
  const scene = useEditorStore(selectActiveScene);

  if (audioTrack) {
    return (
      <VerticalIconTabs
        tabKey="audio"
        defaultValue="audio-fx"
        items={AUDIO_TABS}
        contents={{ "audio-fx": <AudioFxTab /> }}
      />
    );
  }

  if (layer) {
    return (
      <VerticalIconTabs
        tabKey="layer"
        defaultValue="props"
        items={LAYER_TABS}
        contents={{
          props: <PropsTab />,
          html: <HtmlTab />,
          css: <CssTab />,
          keyframes: <KeyframesTab />,
          presets: <PresetsTab layer={layer} />,
        }}
      />
    );
  }

  if (scene) {
    return (
      <VerticalIconTabs
        tabKey="scene"
        defaultValue="scene"
        items={SCENE_TABS}
        contents={{
          scene: <SceneTab />,
          transition: <TransitionTab />,
          keyframes: <KeyframesTab />,
        }}
      />
    );
  }

  return (
    <div className="p-4 text-sm text-muted-foreground">
      Select a scene, layer, or audio track.
    </div>
  );
}
