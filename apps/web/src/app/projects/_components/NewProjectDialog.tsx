"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewProjectFormSchema } from "@open-effects/shared-types";
import { cn } from "@/lib/utils";

type FormErrors = Partial<Record<"name" | "width" | "height" | "fps", string>>;

type SizePreset = {
  id: string;
  ratio: string;
  width: number;
  height: number;
  caption: string;
};

const SIZE_PRESETS: readonly SizePreset[] = [
  {
    id: "ig-square",
    ratio: "1:1",
    width: 1080,
    height: 1080,
    caption: "Instagram Post · 1080 × 1080",
  },
  {
    id: "ig-portrait",
    ratio: "4:5",
    width: 1080,
    height: 1350,
    caption: "Instagram Portrait · 1080 × 1350",
  },
  {
    id: "vertical",
    ratio: "9:16",
    width: 1080,
    height: 1920,
    caption: "Reel · Story · Short · 1080 × 1920",
  },
  {
    id: "yt-hd",
    ratio: "16:9",
    width: 1920,
    height: 1080,
    caption: "YouTube HD · 1920 × 1080",
  },
];

function findPresetId(width: number, height: number): string | null {
  const match = SIZE_PRESETS.find((p) => p.width === width && p.height === height);
  return match ? match.id : null;
}

function AspectIcon({
  width,
  height,
  active,
}: {
  width: number;
  height: number;
  active: boolean;
}) {
  const max = 18;
  const ratio = width / height;
  const w = ratio >= 1 ? max : Math.round(max * ratio);
  const h = ratio >= 1 ? Math.round(max / ratio) : max;
  return (
    <div className="grid h-5 w-5 place-items-center">
      <div
        className={cn(
          "rounded-[2px] border",
          active ? "border-foreground bg-foreground/10" : "border-muted-foreground/60",
        )}
        style={{ width: w, height: h }}
      />
    </div>
  );
}

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  function resetForm() {
    setName("");
    setWidth(1920);
    setHeight(1080);
    setFps(30);
    setApiError(null);
    setFieldErrors({});
  }

  function validate(): FormErrors {
    const result = NewProjectFormSchema.safeParse({ name, width, height, fps });
    if (result.success) return {};
    const errors: FormErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof FormErrors;
      if (!errors[field]) {
        errors[field] = issue.message;
      }
    }
    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    setApiError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          width: Number(width),
          height: Number(height),
          fps,
        }),
      });
      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        setOpen(false);
        resetForm();
        router.push(`/projects/${id}`);
      } else {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.error === "string"
            ? body.error
            : "Failed to create project. Please check your inputs.";
        setApiError(message);
        console.error("POST /api/projects failed", res.status, body);
      }
    } catch (err) {
      setApiError("Network error. Please try again.");
      console.error("POST /api/projects error", err);
    } finally {
      setSubmitting(false);
    }
  }

  const hasErrors = Object.values(fieldErrors).some(Boolean);
  const activePresetId = findPresetId(width, height);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button>+ New project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="np-name">Name</Label>
            <Input
              id="np-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name)
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="My project"
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Size</Label>
            <div
              role="radiogroup"
              aria-label="Size preset"
              className="flex flex-wrap items-start gap-1"
            >
              {SIZE_PRESETS.map((preset) => {
                const active = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setWidth(preset.width);
                      setHeight(preset.height);
                      setFieldErrors((prev) => ({
                        ...prev,
                        width: undefined,
                        height: undefined,
                      }));
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border px-3 py-1.5 text-[11px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-foreground bg-accent text-foreground"
                        : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <AspectIcon
                      width={preset.width}
                      height={preset.height}
                      active={active}
                    />
                    <span>{preset.ratio}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {activePresetId
                ? SIZE_PRESETS.find((p) => p.id === activePresetId)?.caption
                : `Custom · ${width || 0} × ${height || 0}`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="np-width">Width (px)</Label>
              <Input
                id="np-width"
                type="number"
                min={1}
                max={7680}
                value={width}
                onChange={(e) => {
                  setWidth(Number(e.target.value));
                  if (fieldErrors.width)
                    setFieldErrors((prev) => ({ ...prev, width: undefined }));
                }}
              />
              {fieldErrors.width && (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.width}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="np-height">Height (px)</Label>
              <Input
                id="np-height"
                type="number"
                min={1}
                max={7680}
                value={height}
                onChange={(e) => {
                  setHeight(Number(e.target.value));
                  if (fieldErrors.height)
                    setFieldErrors((prev) => ({ ...prev, height: undefined }));
                }}
              />
              {fieldErrors.height && (
                <p className="text-xs text-destructive" role="alert">
                  {fieldErrors.height}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="np-fps">Frame rate</Label>
            <Select
              value={String(fps)}
              onValueChange={(v) => {
                setFps(Number(v) as 24 | 30 | 60);
                if (fieldErrors.fps)
                  setFieldErrors((prev) => ({ ...prev, fps: undefined }));
              }}
            >
              <SelectTrigger id="np-fps">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.fps && (
              <p className="text-xs text-destructive" role="alert">
                {fieldErrors.fps}
              </p>
            )}
          </div>
          {apiError && (
            <p className="text-sm text-destructive" role="alert">
              {apiError}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting || hasErrors}>
              {submitting ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
