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

type FormErrors = Partial<Record<"name" | "width" | "height" | "fps", string>>;

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
