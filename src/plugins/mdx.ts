/**
 * The MDX plugin, defined once.
 *
 * Both vite.config.ts and vitest.config.ts need it — the test run compiles the
 * same .mdx files the app does. Defining it in one place is not tidiness: if
 * the two configs drift, docs pages pass their tests and break in the build,
 * or vice versa.
 */
import type { CompileOptions } from "@mdx-js/mdx";
import mdx from "@mdx-js/rollup";
import rehypeShiki from "@shikijs/rehype";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { Plugin } from "vite";

import { SHIKI_THEMES } from "./shiki.ts";

/**
 * `jsx: true` leaves JSX in the output instead of calling a JSX runtime:
 * Solid's JSX is COMPILED by babel-preset-solid, not executed. The Solid plugin
 * then has to be told to process .mdx as well — see `extensions` at both call
 * sites.
 *
 * `enforce: "pre"` is what actually orders this before the Solid plugin. Array
 * order alone is not enough; Vite sorts by `enforce` first.
 */
/**
 * Shared with the tests, which compile the same pages to check tag coverage.
 * Exported so the two can never drift.
 */
export const MDX_OPTIONS: CompileOptions = {
  jsx: true,
  // MDX defaults to React's attribute spellings — `className`, camelCase style
  // keys. Solid wants `class`, and its style objects are applied through
  // setProperty(), which needs real kebab-case CSS names. Getting this wrong is
  // silent: the attribute simply never lands. Same trap as echarts-legend.tsx.
  elementAttributeNameCase: "html",
  stylePropertyNameCase: "css",
  // remarkFrontmatter only PARSES the --- block out of the body;
  // remarkMdxFrontmatter is what re-exports it as `frontmatter`. Both are
  // needed — with only the first, the title vanishes silently.
  remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm],
  // Fenced code blocks in .mdx are highlighted here, at build time, with the
  // same dual-theme setup as the ?shiki plugin — so a fenced snippet and a Code
  // tab look identical. Note this injects <span> into pages, which is why
  // MDX_TAGS in mdx-components.tsx covers more than markdown's own elements.
  rehypePlugins: [rehypeSlug, [rehypeShiki, { themes: SHIKI_THEMES, defaultColor: false }]],
};

export function mdxPlugin(): Plugin {
  return { enforce: "pre", ...mdx(MDX_OPTIONS) } as Plugin;
}
