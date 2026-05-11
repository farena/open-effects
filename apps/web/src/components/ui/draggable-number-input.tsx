"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DraggableNumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  sensitivity?: number;
};

const DRAG_THRESHOLD_PX = 3;

const DraggableNumberInput = React.forwardRef<
  HTMLInputElement,
  DraggableNumberInputProps
>(function DraggableNumberInput(
  {
    className,
    onChange,
    onBlur,
    value,
    defaultValue,
    step,
    min,
    max,
    sensitivity,
    disabled,
    ...rest
  },
  forwardedRef
) {
  const innerRef = React.useRef<HTMLInputElement | null>(null);
  const setRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef)
        (forwardedRef as React.RefObject<HTMLInputElement | null>).current =
          node;
    },
    [forwardedRef]
  );

  const dragRef = React.useRef<{
    startX: number;
    startValue: number;
    pointerId: number;
    dragging: boolean;
  } | null>(null);

  function readNumber(): number {
    if (value !== undefined && value !== "") {
      const n = Number(value);
      if (!Number.isNaN(n)) return n;
    }
    const raw = innerRef.current?.value;
    if (raw !== undefined && raw !== "") {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }
    if (defaultValue !== undefined && defaultValue !== "") {
      const n = Number(defaultValue);
      if (!Number.isNaN(n)) return n;
    }
    return 0;
  }

  function emitChange(next: number) {
    const input = innerRef.current;
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, String(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function emitBlur() {
    if (!onBlur || !innerRef.current) return;
    const fake = {
      target: innerRef.current,
      currentTarget: innerRef.current,
    } as unknown as React.FocusEvent<HTMLInputElement>;
    onBlur(fake);
  }

  function onPointerDown(e: React.PointerEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.button !== 0) return;
    // If already focused, allow normal text-cursor interaction
    if (document.activeElement === innerRef.current) return;

    dragRef.current = {
      startX: e.clientX,
      startValue: readNumber(),
      pointerId: e.pointerId,
      dragging: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLInputElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (!drag.dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      try {
        innerRef.current?.setPointerCapture(drag.pointerId);
      } catch {
        // ignore
      }
    }
    e.preventDefault();

    const stepValue =
      step !== undefined && step !== "" && !Number.isNaN(Number(step))
        ? Number(step)
        : 1;
    const base = sensitivity ?? stepValue;
    let multiplier = 1;
    if (e.shiftKey) multiplier *= 10;
    if (e.altKey) multiplier *= 0.1;

    let next = drag.startValue + dx * base * multiplier;
    if (stepValue > 0) {
      const grid = stepValue;
      next = Math.round(next / grid) * grid;
      if (grid < 1) {
        const decimals = Math.max(0, -Math.floor(Math.log10(grid)));
        next = parseFloat(next.toFixed(decimals));
      }
    }
    if (min !== undefined && min !== "" && !Number.isNaN(Number(min))) {
      next = Math.max(Number(min), next);
    }
    if (max !== undefined && max !== "" && !Number.isNaN(Number(max))) {
      next = Math.min(Number(max), next);
    }

    emitChange(next);
  }

  function onPointerUp(e: React.PointerEvent<HTMLInputElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const wasDragging = drag.dragging;
    if (wasDragging) {
      try {
        innerRef.current?.releasePointerCapture(drag.pointerId);
      } catch {
        // ignore
      }
      // Keep input out of edit mode after a drag — match Figma/Blender feel
      innerRef.current?.blur();
      e.preventDefault();
      emitBlur();
    }
    dragRef.current = null;
  }

  return (
    <Input
      ref={setRef}
      type="number"
      className={cn("cursor-ew-resize focus:cursor-text", className)}
      value={value}
      defaultValue={defaultValue}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      onChange={onChange}
      onBlur={onBlur}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      {...rest}
    />
  );
});

export { DraggableNumberInput };
