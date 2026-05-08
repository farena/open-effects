"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function LoadingSkeleton({
  rows = 3,
  rowClassName = "h-8",
}: {
  rows?: number;
  rowClassName?: string;
}) {
  return (
    <div className="space-y-2 p-2" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={rowClassName} />
      ))}
    </div>
  );
}

export function ErrorBlock({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-center"
    >
      <AlertCircle className="h-5 w-5 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
