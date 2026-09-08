/**
 * The docs page registry.
 *
 * Both halves come from `virtual:docs-index`: titles and headings read off disk
 * at build time, and a lazy `import()` per page. They stay lazy on purpose —
 * importing a page to read its title would drag its charts into the entry
 * chunk, which Rollup will tell you about as INEFFECTIVE_DYNAMIC_IMPORT.
 */
import { DOCS_INDEX, DOCS_LOADERS } from "virtual:docs-index";
import type { DocsHeading } from "virtual:docs-index";
import type { Component } from "solid-js";

type LazyModule = { default: Component<{ components?: Record<string, unknown> }> };

export type DocsPage = {
  slug: string;
  title: string;
  description?: string;
  order: number;
  group?: string;
  headings: DocsHeading[];
  load: () => Promise<LazyModule>;
};

export const DOCS_PAGES: DocsPage[] = DOCS_INDEX.map((entry) => {
  // Metadata and loader are emitted together by the same plugin pass, so this
  // cannot miss — see the note in src/plugins/docs-index.ts about why that
  // matters more than it looks.
  const load = DOCS_LOADERS[entry.slug] as () => Promise<LazyModule>;
  return {
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    order: entry.order,
    group: entry.group,
    headings: entry.headings,
    load,
  };
});

export function findDocsPage(slug: string): DocsPage | undefined {
  return DOCS_PAGES.find((p) => p.slug === slug);
}

export type DocsSection = { group?: string; pages: DocsPage[] };

/**
 * DOCS_PAGES in sidebar order, split into sections.
 *
 * Sections appear in the order their first page does, so a group's position is
 * just its lowest `order` — there is no second ordering to keep in sync.
 */
export function docsSections(): DocsSection[] {
  const sections: DocsSection[] = [];
  for (const page of DOCS_PAGES) {
    const last = sections.at(-1);
    if (last && last.group === page.group) last.pages.push(page);
    else sections.push({ group: page.group, pages: [page] });
  }
  return sections;
}
