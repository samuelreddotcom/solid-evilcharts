/**
 * The MDX plugin, defined once.
 *
 * Both vite.config.ts and vitest.config.ts need it — the test run compiles the
 * same .mdx files the app does. Defining it in one place is not tidiness: if
 * the two configs drift, docs pages pass their tests and break in the build,
 * or vice versa.
 */
import mdx from "@mdx-js/rollup";
import rehypeSlug from "rehype-slug";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import type { Plugin } from "vite";

/**
 * `jsx: true` leaves JSX in the output instead of calling a JSX runtime:
 * Solid's JSX is COMPILED by babel-preset-solid, not executed. The Solid plugin
 * then has to be told to process .mdx as well — see `extensions` at both call
 * sites.
 *
 * `enforce: "pre"` is what actually orders this before the Solid plugin. Array
 * order alone is not enough; Vite sorts by `enforce` first.
 */
export function mdxPlugin(): Plugin {
  return {
    enforce: "pre",
    ...mdx({
      jsx: true,
      // remarkFrontmatter only PARSES the --- block out of the body;
      // remarkMdxFrontmatter is what re-exports it as `frontmatter`. Both are
      // needed — with only the first, the title vanishes silently.
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter, remarkGfm],
      rehypePlugins: [rehypeSlug],
    }),
  } as Plugin;
}
