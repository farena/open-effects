import type { CSSProperties } from "react";

export type AnimatableType = "numeric" | "length-px" | "angle-deg" | "color";

export interface PropertyMeta {
  /** Property key as stored in Keyframe.property */
  key: string;
  /** CSS property this contributes to */
  cssProp: keyof CSSProperties | string;
  /** If this is a sub-property of a compound CSS prop (e.g. transform) */
  subProp?: "translateX" | "translateY" | "scale" | "rotate";
  /** Value type for parsing/lerping/serializing */
  type: AnimatableType;
  /** Default serialized value if no keyframe applies */
  defaultValue: string;
  /** Friendly label for UI */
  label: string;
}

export const PROPERTIES: Record<string, PropertyMeta> = {
  "opacity":              { key: "opacity",              cssProp: "opacity",          type: "numeric",   defaultValue: "1",                   label: "Opacity" },
  "transform.translateX": { key: "transform.translateX", cssProp: "transform", subProp: "translateX", type: "length-px", defaultValue: "0px",  label: "Translate X" },
  "transform.translateY": { key: "transform.translateY", cssProp: "transform", subProp: "translateY", type: "length-px", defaultValue: "0px",  label: "Translate Y" },
  "transform.scale":      { key: "transform.scale",      cssProp: "transform", subProp: "scale",      type: "numeric",   defaultValue: "1",    label: "Scale" },
  "transform.rotate":     { key: "transform.rotate",     cssProp: "transform", subProp: "rotate",     type: "angle-deg", defaultValue: "0deg", label: "Rotate" },
  "color":                { key: "color",                cssProp: "color",            type: "color",     defaultValue: "rgba(255,255,255,1)", label: "Color" },
  "background-color":     { key: "background-color",     cssProp: "backgroundColor",  type: "color",     defaultValue: "rgba(0,0,0,0)",       label: "Background color" },
  "border-radius":        { key: "border-radius",        cssProp: "borderRadius",     type: "length-px", defaultValue: "0px",                 label: "Border radius" },
  "width":                { key: "width",                cssProp: "width",            type: "length-px", defaultValue: "auto",                label: "Width" },
  "height":               { key: "height",               cssProp: "height",           type: "length-px", defaultValue: "auto",                label: "Height" },
  "top":                  { key: "top",                  cssProp: "top",              type: "length-px", defaultValue: "0px",                 label: "Top" },
  "left":                 { key: "left",                 cssProp: "left",             type: "length-px", defaultValue: "0px",                 label: "Left" },
};

export const ANIMATABLE_KEYS = Object.keys(PROPERTIES);
