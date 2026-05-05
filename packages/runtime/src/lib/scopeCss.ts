import postcss from "postcss";
import prefixer from "postcss-prefix-selector";

export function scopeCss(css: string, prefix: string): string {
  if (!css.trim()) return "";
  try {
    const result = postcss([
      prefixer({
        prefix,
        transform(prefix, selector, prefixedSelector) {
          // Avoid prefixing :root and html
          if (selector.startsWith(":root") || selector === "html") return selector;
          return prefixedSelector;
        }
      })
    ]).process(css, { from: undefined });
    return result.css;
  } catch (err) {
    console.warn("[scopeCss] failed to scope CSS, dropping rule set:", err);
    return "";
  }
}
