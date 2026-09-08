/**
 * "On This Page" anchors must actually land.
 *
 * The heading list is parsed off the .mdx source by src/plugins/docs-index.ts;
 * the ids on the rendered headings are put there by rehype-slug. Those are two
 * independent implementations of the same slug, and when they disagree the
 * failure is invisible — the sidebar renders, the links look fine, and clicking
 * one does nothing.
 *
 * So: compile each page for real and compare the ids it emits against the ones
 * the index advertises.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";

/**
 * Shiki's first call costs ~2.6s of module and WASM init (measured; later
 * compiles are ~12ms), and each test file pays it once. Under the default 5s
 * that failed roughly two runs in five — a flake, not a slow test.
 */
const COMPILE_TIMEOUT_MS = 30_000;

import { MDX_OPTIONS } from "../../plugins/mdx.ts";
import { DOCS_PAGES } from "./docs-pages";

/** ids rehype-slug actually put on h2/h3 in the compiled output. */
function renderedHeadingIds(compiled: string): string[] {
  return [...compiled.matchAll(/<_components\.h[23]\s+id="([^"]+)"/g)].map((m) => m[1]!);
}

describe("docs headings", () => {
  it("has pages to check", () => {
    expect(DOCS_PAGES.length).toBeGreaterThan(0);
  });

  for (const page of DOCS_PAGES) {
    it(
      `${page.slug}: every "On this page" anchor exists in the rendered page`,
      async () => {
        const source = DOCS_PAGES.find((p) => p.slug === page.slug)!;
        const file = readFileSync(
          resolve(import.meta.dirname, `../../content/docs/${page.slug}.mdx`),
        );
        const compiled = String(await compile(file, MDX_OPTIONS));
        const rendered = renderedHeadingIds(compiled);

        // Guard against the whole comparison being vacuous: two empty lists are
        // equal, and would prove nothing.
        expect(rendered.length).toBeGreaterThan(0);

        // Every advertised anchor must exist on the page...
        const dangling = source.headings.map((h) => h.id).filter((id) => !rendered.includes(id));
        expect(dangling).toEqual([]);

        // ...and the list must not silently miss headings the page does have.
        expect(source.headings.map((h) => h.id)).toEqual(rendered);
      },
      COMPILE_TIMEOUT_MS,
    );
  }
});
