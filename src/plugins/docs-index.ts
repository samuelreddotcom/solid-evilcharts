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

export function docsIndex(contentDir: string): Plugin {
  const root = resolve(contentDir);

  function build(): DocsIndexEntry[] {
    return walk(root)
      .map((file) => {
        const { data, content } = matter(readFileSync(file, "utf8"));
        const slug = relative(root, file).replace(/\.mdx$/, "");
        return {
          slug,
          title: typeof data.title === "string" ? data.title : slug,
          description: typeof data.description === "string" ? data.description : undefined,
          path: file,
          headings: headingsOf(content),
        };
      })
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }

  return {
    name: "docs-index",
    resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : undefined),
    load(id) {
      if (id !== RESOLVED_ID) return;
      return `export const DOCS_INDEX = ${JSON.stringify(build())};`;
    },
    hotUpdate({ file, server }) {
      if (!file.endsWith(".mdx")) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
      if (mod) server.moduleGraph.invalidateModule(mod);
    },
  };
}
