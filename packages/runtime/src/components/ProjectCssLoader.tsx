import React, { useEffect, useMemo, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

// Matches @import url("..."), @import url('...'), @import url(...) and the
// bare @import "..." / @import '...' forms. Captures the URL in group 1, 2 or 3.
const IMPORT_RE =
  /@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^)]+))\s*\)|"([^"]+)"|'([^']+)')[^;]*;/g;

type Split = { imports: string[]; rest: string };

function splitImports(css: string): Split {
  const imports: string[] = [];
  const rest = css.replace(IMPORT_RE, (_match, a, b, c, d, e) => {
    const url = (a ?? b ?? c ?? d ?? e ?? "").trim();
    if (url) imports.push(url);
    return "";
  });
  return { imports, rest };
}

/**
 * Injects the project's global CSS and gates Remotion's render until external
 * font stylesheets and webfonts have actually loaded. Without this gate the
 * Player paints frames while @import-loaded stylesheets are still in flight,
 * which causes per-frame font swapping ("flicker"). `@import` rules are
 * extracted into <link rel="stylesheet"> tags so we can await onLoad
 * deterministically; the remaining CSS stays in a <style> tag.
 */
export const ProjectCssLoader: React.FC<{ css: string }> = ({ css }) => {
  const { imports, rest } = useMemo(() => splitImports(css), [css]);

  const [handle] = useState(() =>
    delayRender("Loading project CSS and fonts", {
      timeoutInMilliseconds: 30000,
    }),
  );
  const continuedRef = useRef(false);
  const pendingLinksRef = useRef(new Set<string>(imports));

  const finish = () => {
    if (continuedRef.current) return;
    if (typeof document === "undefined") {
      continuedRef.current = true;
      continueRender(handle);
      return;
    }
    document.fonts.ready
      .then(() => {
        if (continuedRef.current) return;
        continuedRef.current = true;
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  };

  useEffect(() => {
    if (imports.length === 0) finish();
    // We only want to fire `finish` once after the initial mount when there
    // are no @import URLs. Link onLoad handles the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLinkLoad = (url: string) => {
    pendingLinksRef.current.delete(url);
    if (pendingLinksRef.current.size === 0) finish();
  };

  const handleLinkError = (url: string) => {
    // Treat as resolved so we don't hang the render on a single bad URL.
    pendingLinksRef.current.delete(url);
    if (pendingLinksRef.current.size === 0) finish();
  };

  return (
    <>
      {imports.map((url) => (
        <link
          key={url}
          rel="stylesheet"
          href={url}
          crossOrigin="anonymous"
          onLoad={() => handleLinkLoad(url)}
          onError={() => handleLinkError(url)}
        />
      ))}
      {rest.trim() && (
        <style
          data-open-effects-project-css
          dangerouslySetInnerHTML={{ __html: rest }}
        />
      )}
    </>
  );
};
