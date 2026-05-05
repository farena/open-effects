type TransformParts = Partial<Record<"translateX" | "translateY" | "scale" | "rotate", string>>;

export function composeTransform(parts: TransformParts): string {
  const segs: string[] = [];
  if (parts.translateX !== undefined || parts.translateY !== undefined) {
    segs.push(`translate(${parts.translateX ?? "0px"}, ${parts.translateY ?? "0px"})`);
  }
  if (parts.scale !== undefined) segs.push(`scale(${parts.scale})`);
  if (parts.rotate !== undefined) segs.push(`rotate(${parts.rotate})`);
  return segs.join(" ");
}
