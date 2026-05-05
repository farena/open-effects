"use client";

import { PROPERTIES } from "@open-effects/runtime";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PropertyPickerProps {
  value: string | null;
  onChange: (propertyKey: string) => void;
  excludedKeys?: string[];
}

const sortedProperties = Object.values(PROPERTIES).sort((a, b) =>
  a.label.localeCompare(b.label)
);

export function PropertyPicker({
  value,
  onChange,
  excludedKeys = [],
}: PropertyPickerProps) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Pick a property..." />
      </SelectTrigger>
      <SelectContent>
        {sortedProperties.map((meta) => {
          const isExcluded = excludedKeys.includes(meta.key);
          return (
            <SelectItem
              key={meta.key}
              value={meta.key}
              disabled={isExcluded}
              className={isExcluded ? "opacity-40" : undefined}
            >
              {meta.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
