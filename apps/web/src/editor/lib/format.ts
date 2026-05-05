"use client";

import prettier from "prettier/standalone";
import htmlPlugin from "prettier/plugins/html";
import postcssPlugin from "prettier/plugins/postcss";

const baseOptions = {
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
};

export async function formatHtml(source: string): Promise<string> {
  return prettier.format(source, {
    ...baseOptions,
    parser: "html",
    plugins: [htmlPlugin],
  });
}

export async function formatScss(source: string): Promise<string> {
  return prettier.format(source, {
    ...baseOptions,
    parser: "scss",
    plugins: [postcssPlugin],
  });
}
