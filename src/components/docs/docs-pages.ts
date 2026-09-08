/**
 * The docs page registry.
 *
 * Titles come from `virtual:docs-index` (frontmatter read off disk at build
 * time — see src/plugins/docs-index.ts); bodies come from a lazy glob. Keeping
 * those two separate is the whole point: importing a page to read its title
 * would drag its charts into the entry chunk.
 */
import { DOCS_INDEX } from "virtual:docs-index";
import type { DocsHeading } from "virtual:docs-index";
import type { Component } from "solid-js";

type LazyModule = { default: Component<{ components?: Record<string, unknown> }> };

const LAZY = import.meta.glob<LazyModule>("../../content/docs/**/*.mdx");

/** The glob keys are project-relative; the index carries absolute paths. */
function loaderFor(absolutePath: string): (() => Promise<LazyModule>) | undefined {
  const match = Object.keys(LAZY).find((key) =>
    absolutePath.endsWith(key.replace(/^(\.\.\/)+/, "").replace(/^src\//, "")),
  );
  return match ? LAZY[match] : undefined;
}

export type DocsPage = {
  slug: string;
  title: string;
  description?: string;
  headings: DocsHeading[];
  load: () => Promise<LazyModule>;
};

export const DOCS_PAGES: DocsPage[] = DOCS_INDEX.map((entry) => {
  const load = loaderFor(entry.path);
  if (!load) {
    // The plugin and the glob read the same directory, so this only fires if
    // the two patterns drift. Fail loudly rather than render a blank page.
    throw new Error(`docs: no lazy loader for ${entry.path}`);
  }
  return {
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    headings: entry.headings,
    load,
  };
});

export function findDocsPage(slug: string): DocsPage | undefined {
  return DOCS_PAGES.find((p) => p.slug === slug);
}
