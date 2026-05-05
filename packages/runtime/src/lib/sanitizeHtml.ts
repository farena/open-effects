import DOMPurify from "isomorphic-dompurify";
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_ATTR: ["class", "style", "id", "src", "alt", "href", "title", "width", "height"],
    ADD_DATA_URI_TAGS: ["img"],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"]
  });
}
