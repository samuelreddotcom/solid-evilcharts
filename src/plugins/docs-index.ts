/**
 * Build-time docs index, exposed as `virtual:docs-index`.
 *
 * Why a plugin rather than `import.meta.glob(..., { eager: true })`:
 * the sidebar needs every page's title, but eager-globbing the pages to get
 * them statically imports the pages themselves — and a docs page imports the
 * chart it documents. Rollup says so out loud:
 *
 *   [INEFFECTIVE_DYNAMIC_IMPORT] introduction.mdx is dynamically imported by
 *   docs-pages.ts but also statically imported by docs-pages.ts
 *
 * The lazy glob then buys nothing, and every chart lands in the entry chunk.
 * Reading the frontmatter off disk at build time keeps titles static and the
 * page bodies genuinely lazy.
 */
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import GithubSlugger from "github-slugger";
import matter from "gray-matter";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:docs-index";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

export type DocsHeading = { depth: 2 | 3; text: string; id: string };

export type DocsIndexEntry = {
  slug: string;
  title: string;
  description?: string;
  /** Sidebar position. Pages without one sort last, alphabetically. */
  order: number;
  /** Sidebar section heading. Ungrouped pages sit above every group. */
  group?: string;
  /** Path relative to the project root, so the lazy glob can key off it. */
  path: string;
  headings: DocsHeading[];
};

/**
 * Headings for "On This Page", read at build time from the same file the
 * sidebar's frontmatter comes from.
 *
 * The ids MUST match what rehype-slug puts on the rendered headings, or every
 * anchor is a dead link. rehype-slug uses github-slugger, so this does too —
 * a hand-rolled slugify would agree on "Installing" and diverge on the first
 * heading with punctuation.
 *
 * Fenced code blocks are stripped first: a `# comment` inside a bash block is
 * not a heading, and `## ` inside a diff would be worse.
 */
function headingsOf(body: string): DocsHeading[] {
  const withoutCode = body.replace(/^```[\s\S]*?^```/gm, "");
  const slugger = new GithubSlugger();
  return [...withoutCode.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map((m) => {
    const text = m[2]!.replace(/`/g, "");
    return {
      depth: m[1]!.length as 2 | 3,
      text,
      id: slugger.slug(text),
    };
  });
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // `_demos/` holds components imported BY pages. They are not pages.
    if (entry.name.startsWith("_")) return [];
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".mdx") ? [full] : [];
  });
}

/**
 * The docs index, read straight off disk.
 *
 * Exported separately from the plugin because `scripts/build-seo.mts` needs the
 * same titles and descriptions to write per-route <head> tags and the sitemap,
 * and it runs after `vite build` with no Vite around to resolve a virtual
 * module. Sharing the function rather than re-parsing the frontmatter is what
 * stops the sidebar and the sitemap from ever describing different sites.
 */
export function buildDocsIndex(contentDir: string): DocsIndexEntry[] {
  const root = resolve(contentDir);
  return (
    walk(root)
      .map((file) => {
        const { data, content } = matter(readFileSync(file, "utf8"));
        const slug = relative(root, file).replace(/\.mdx$/, "");
        return {
          slug,
          title: typeof data.title === "string" ? data.title : slug,
          description: typeof data.description === "string" ? data.description : undefined,
          order: typeof data.order === "number" ? data.order : Number.MAX_SAFE_INTEGER,
          group: typeof data.group === "string" ? data.group : undefined,
          path: file,
          headings: headingsOf(content),
        };
      })
      // Explicit `order` first, alphabetical for anything that forgot one, so a
      // new page appears somewhere sensible rather than vanishing to the end.
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
  );
}

export function docsIndex(contentDir: string): Plugin {
  const build = () => buildDocsIndex(contentDir);

  return {
    name: "docs-index",
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return;
      const entries = build();
      // DOCS_LOADERS is emitted here, next to the metadata, rather than left to
      // an `import.meta.glob` in a consumer module. That is not tidiness.
      //
      // Vitest runs with `fsModuleCache: true`. A glob is baked in at transform
      // time, so a module containing one keeps its cached transform until that
      // module's own source changes — and adding a .mdx file does not change
      // it. The cached glob then has no entry for the new page while this
      // virtual module, rebuilt every run, does. The two disagree and the docs
      // registry throws "no lazy loader" until someone clears
      // node_modules/.vitest-cache. Cost an hour to find once.
      //
      // Emitting the imports here makes the generated code itself change when
      // the page set changes, so any cache keyed on it is invalidated for free.
      const loaders = entries
        .map((e) => `  ${JSON.stringify(e.slug)}: () => import(${JSON.stringify(e.path)}),`)
        .join("\n");
      return [
        `export const DOCS_INDEX = ${JSON.stringify(entries)};`,
        `export const DOCS_LOADERS = {\n${loaders}\n};`,
      ].join("\n");
    },
    hotUpdate({ file, server }) {
      if (!file.endsWith(".mdx")) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
    },
  };
}
