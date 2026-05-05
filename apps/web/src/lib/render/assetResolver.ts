import path from "node:path";

export function resolveAssetForRender(publicPath: string): string {
  if (publicPath.startsWith("file://") || /^https?:\/\//.test(publicPath))
    return publicPath;
  if (!publicPath.startsWith("/assets/")) {
    throw new Error(`Unexpected asset path: ${publicPath}`);
  }
  if (publicPath.includes("..")) throw new Error("Path traversal blocked");
  return path.resolve(process.cwd(), "public", publicPath.replace(/^\//, ""));
}
