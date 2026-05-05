declare module "postcss-prefix-selector" {
  import type { Plugin } from "postcss";
  interface Options {
    prefix: string;
    exclude?: (string | RegExp)[];
    transform?: (
      prefix: string,
      selector: string,
      prefixedSelector: string,
      filePath?: string,
      rule?: unknown
    ) => string;
    includeFiles?: (string | RegExp)[];
    excludeFiles?: (string | RegExp)[];
  }
  const plugin: (options: Options) => Plugin;
  export default plugin;
}
