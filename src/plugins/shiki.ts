/**
 * Build-time syntax highlighting for `?shiki` imports.
 *
 *   import html from "~/registry/charts/line-chart/line-chart.tsx?shiki";
 *
 * resolves to a pre-rendered HTML string. The point is that Shiki never reaches
 * the browser: it carries every grammar and theme it knows, and a docs site
 * that highlights at runtime pays for that on first paint. Highlighting here
 * means the client ships plain HTML, and `import.meta.glob(…, { query })` still
 * makes each file its own lazy chunk.
 *
 * Dual-theme with `defaultColor: false` emits `--shiki-light` / `--shiki-dark`
 * CSS variables rather than baked colours, so one render serves both themes and
 * the `.dark` class switches it in CSS. Same themes as EvilCharts
 * (`min-light` / `vesper`) so the docs read the same.
 */
import { readFile } from "node:fs/promises";

import { createHighlighter, type Highlighter } from "shiki";
import type { Plugin } from "vite";

const QUERY = "?shiki";

/** Extensions we can highlight, mapped to Shiki's language ids. */
const LANGS: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  css: "css",
  json: "json",
  sh: "bash",
  bash: "bash",
  mdx: "mdx",
};

export const SHIKI_THEMES = { light: "min-light", dark: "vesper" } as const;

export function shikiRaw(): Plugin {
  // One highlighter for the whole build. Creating one per file re-parses every
  // grammar, which turns a fast build into a slow one.
  let highlighter: Promise<Highlighter> | undefined;

  return {
    name: "shiki-raw",
    async load(id) {
      if (!id.includes(QUERY)) return;
      const file = id.slice(0, id.indexOf(QUERY));
      const ext = file.split(".").pop() ?? "";
      const lang = LANGS[ext];
      if (!lang) {
        // Better to fail the build than to silently ship an unhighlighted blob.
        throw new Error(`shiki-raw: no language mapping for ".${ext}" (${file})`);
      }

      highlighter ??= createHighlighter({
        themes: Object.values(SHIKI_THEMES),
        langs: [...new Set(Object.values(LANGS))],
      });

      const code = await readFile(file, "utf8");
      const html = (await highlighter).codeToHtml(code, {
        lang,
        themes: SHIKI_THEMES,
        defaultColor: false,
      });

      // Both are exported: `html` to render, `code` for the copy button — which
      // must copy the source, not the markup.
      return `export const html = ${JSON.stringify(html)};
export const code = ${JSON.stringify(code)};
export default html;`;
    },
  };
}
