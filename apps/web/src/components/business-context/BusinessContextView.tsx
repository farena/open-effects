"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Save, Plus, X, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BusinessContext } from "@open-effects/shared-types";
import { DEFAULT_BUSINESS_CONTEXT } from "@open-effects/shared-types";

interface BusinessContextViewProps {
  context: BusinessContext;
  onSaved: (updated: BusinessContext) => void;
  onReload: () => void;
}

export function BusinessContextView({
  context,
  onSaved,
  onReload,
}: BusinessContextViewProps) {
  const [draft, setDraft] = useState<BusinessContext>(context);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [newKeyMessage, setNewKeyMessage] = useState("");
  const [newDifferentiator, setNewDifferentiator] = useState("");

  useEffect(() => {
    setDraft(context);
  }, [context]);

  const isDirty =
    draft.companyName !== context.companyName ||
    draft.summary !== context.summary ||
    draft.audience !== context.audience ||
    draft.products !== context.products ||
    draft.tone !== context.tone ||
    draft.competitors !== context.competitors ||
    draft.notes !== context.notes ||
    draft.keyMessages.join("|") !== context.keyMessages.join("|") ||
    draft.differentiators.join("|") !== context.differentiators.join("|") ||
    draft.primaryColor !== context.primaryColor ||
    draft.secondaryColor !== context.secondaryColor ||
    draft.accentColor !== context.accentColor ||
    draft.logoLightAssetId !== context.logoLightAssetId ||
    draft.logoDarkAssetId !== context.logoDarkAssetId;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/business-context", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: draft.companyName,
          summary: draft.summary,
          audience: draft.audience,
          products: draft.products,
          tone: draft.tone,
          keyMessages: draft.keyMessages,
          differentiators: draft.differentiators,
          competitors: draft.competitors,
          notes: draft.notes,
          primaryColor: draft.primaryColor,
          secondaryColor: draft.secondaryColor,
          accentColor: draft.accentColor,
          logoLightAssetId: draft.logoLightAssetId,
          logoDarkAssetId: draft.logoDarkAssetId,
        }),
      });
      if (res.ok) {
        const updated: BusinessContext = await res.json();
        onSaved(updated);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }, [draft, onSaved]);

  const addKeyMessage = () => {
    const v = newKeyMessage.trim();
    if (!v) return;
    setDraft({ ...draft, keyMessages: [...draft.keyMessages, v] });
    setNewKeyMessage("");
  };

  const addDifferentiator = () => {
    const v = newDifferentiator.trim();
    if (!v) return;
    setDraft({
      ...draft,
      differentiators: [...draft.differentiators, v],
    });
    setNewDifferentiator("");
  };

  const removeKeyMessage = (i: number) => {
    setDraft({
      ...draft,
      keyMessages: draft.keyMessages.filter((_, idx) => idx !== i),
    });
  };

  const removeDifferentiator = (i: number) => {
    setDraft({
      ...draft,
      differentiators: draft.differentiators.filter((_, idx) => idx !== i),
    });
  };

  const isEmpty =
    draft === DEFAULT_BUSINESS_CONTEXT ||
    (!draft.companyName &&
      !draft.summary &&
      !draft.audience &&
      !draft.products &&
      !draft.tone &&
      draft.keyMessages.length === 0 &&
      draft.differentiators.length === 0 &&
      !draft.competitors &&
      !draft.notes &&
      !draft.primaryColor &&
      !draft.secondaryColor &&
      !draft.accentColor &&
      !draft.logoLightAssetId &&
      !draft.logoDarkAssetId);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-border bg-background flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold">Business Context</h1>
          <p className="text-xs text-muted-foreground">
            Brand memory injected into every project chat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReload}
            aria-label="Reload"
            title="Reload from disk"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            {savedFlash ? (
              <>
                <Check className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {isEmpty && (
            <div className="rounded-xl border border-dashed border-border p-4 text-center">
              <p className="text-sm font-medium mb-1">
                Set up your business context
              </p>
              <p className="text-xs text-muted-foreground">
                Use the Context Coach on the right or fill the fields below.
              </p>
            </div>
          )}

          <Field label="Company name" hint="The brand name as it should appear in copy.">
            <Input
              value={draft.companyName}
              onChange={(e) =>
                setDraft({ ...draft, companyName: e.target.value })
              }
              placeholder="Acme Inc."
            />
          </Field>

          <Field
            label="Logos"
            hint="Upload one variant for light backgrounds and one for dark backgrounds."
          >
            <div className="grid grid-cols-2 gap-3">
              <LogoUploader
                label="Over light"
                background="light"
                assetPath={draft.logoLightAssetPath}
                onUploaded={(asset) =>
                  setDraft({
                    ...draft,
                    logoLightAssetId: asset.id,
                    logoLightAssetPath: asset.path,
                  })
                }
                onClear={() =>
                  setDraft({
                    ...draft,
                    logoLightAssetId: null,
                    logoLightAssetPath: null,
                  })
                }
              />
              <LogoUploader
                label="Over dark"
                background="dark"
                assetPath={draft.logoDarkAssetPath}
                onUploaded={(asset) =>
                  setDraft({
                    ...draft,
                    logoDarkAssetId: asset.id,
                    logoDarkAssetPath: asset.path,
                  })
                }
                onClear={() =>
                  setDraft({
                    ...draft,
                    logoDarkAssetId: null,
                    logoDarkAssetPath: null,
                  })
                }
              />
            </div>
          </Field>

          <Field label="Brand colors" hint="Primary, secondary and accent.">
            <div className="grid grid-cols-3 gap-3">
              <ColorField
                label="Primary"
                value={draft.primaryColor}
                onChange={(v) => setDraft({ ...draft, primaryColor: v })}
              />
              <ColorField
                label="Secondary"
                value={draft.secondaryColor}
                onChange={(v) => setDraft({ ...draft, secondaryColor: v })}
              />
              <ColorField
                label="Accent"
                value={draft.accentColor}
                onChange={(v) => setDraft({ ...draft, accentColor: v })}
              />
            </div>
          </Field>

          <Field label="Summary" hint="One-sentence elevator pitch.">
            <textarea
              value={draft.summary}
              onChange={(e) =>
                setDraft({ ...draft, summary: e.target.value })
              }
              placeholder="We help X do Y by Z."
              rows={2}
              className={textareaClass}
            />
          </Field>

          <Field
            label="Audience"
            hint="Who you sell to — role, industry, pain point."
          >
            <textarea
              value={draft.audience}
              onChange={(e) =>
                setDraft({ ...draft, audience: e.target.value })
              }
              placeholder="Founders of language schools..."
              rows={3}
              className={textareaClass}
            />
          </Field>

          <Field label="Products / services">
            <textarea
              value={draft.products}
              onChange={(e) =>
                setDraft({ ...draft, products: e.target.value })
              }
              placeholder="We sell..."
              rows={3}
              className={textareaClass}
            />
          </Field>

          <Field
            label="Tone of voice"
            hint="e.g. expert and warm, edgy and direct, cinematic, playful."
          >
            <Input
              value={draft.tone}
              onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
              placeholder="Cinematic, direct, no fluff."
            />
          </Field>

          <Field
            label="Key messages"
            hint="Recurring talking points to reinforce in every video."
          >
            <div className="space-y-2">
              {draft.keyMessages.map((msg, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <span className="flex-1">{msg}</span>
                  <button
                    onClick={() => removeKeyMessage(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newKeyMessage}
                  onChange={(e) => setNewKeyMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyMessage();
                    }
                  }}
                  placeholder="Add a key message and press Enter"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addKeyMessage}
                  disabled={!newKeyMessage.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Field>

          <Field label="Differentiators" hint="Why you, not the alternative.">
            <div className="space-y-2">
              {draft.differentiators.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm"
                >
                  <span className="flex-1">{d}</span>
                  <button
                    onClick={() => removeDifferentiator(i)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newDifferentiator}
                  onChange={(e) => setNewDifferentiator(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDifferentiator();
                    }
                  }}
                  placeholder="Add a differentiator and press Enter"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addDifferentiator}
                  disabled={!newDifferentiator.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Field>

          <Field
            label="Competitors / alternatives"
            hint="Who or what people use instead of you."
          >
            <textarea
              value={draft.competitors}
              onChange={(e) =>
                setDraft({ ...draft, competitors: e.target.value })
              }
              placeholder="Esemtia, Aladdin, manual spreadsheets..."
              rows={2}
              className={textareaClass}
            />
          </Field>

          <Field
            label="Extra notes"
            hint="Jargon, recurring objections, things to avoid, visual references."
          >
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Avoid the phrase &quot;all-in-one&quot;..."
              rows={4}
              className={textareaClass}
            />
          </Field>

          {context.updatedAt && (
            <p className="text-[11px] text-muted-foreground text-right">
              Last saved: {new Date(context.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const textareaClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium block">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const swatch = value ?? "#ffffff";
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input overflow-hidden"
          style={{ backgroundColor: swatch }}
          aria-label={`${label} color picker`}
        >
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={swatch}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="#000000"
          className="font-mono text-xs"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Clear ${label}`}
            title="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

interface UploadedAsset {
  id: string;
  path: string;
  filename: string;
  type: string;
}

function LogoUploader({
  label,
  background,
  assetPath,
  onUploaded,
  onClear,
}: {
  label: string;
  background: "light" | "dark";
  assetPath: string | null;
  onUploaded: (asset: UploadedAsset) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/assets", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const asset: UploadedAsset = await res.json();
      onUploaded(asset);
    } finally {
      setBusy(false);
    }
  };

  const bg = background === "light" ? "bg-white" : "bg-neutral-900";
  const borderColor =
    background === "light" ? "border-neutral-200" : "border-neutral-700";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {assetPath && (
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${label} logo`}
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        hidden
        accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={`group relative flex h-28 w-full items-center justify-center rounded-md border ${borderColor} ${bg} transition hover:brightness-95 disabled:opacity-50`}
      >
        {assetPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetPath}
            alt={`${label} logo`}
            className="max-h-full max-w-full object-contain p-2"
          />
        ) : (
          <span
            className={`flex flex-col items-center gap-1 text-xs ${background === "light" ? "text-neutral-500" : "text-neutral-400"}`}
          >
            <Upload className="h-4 w-4" />
            {busy ? "Uploading…" : "Upload"}
          </span>
        )}
      </button>
    </div>
  );
}
