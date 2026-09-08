/**
 * Checks MDX_TAGS against what the pages actually ask for.
 *
 * MDX hands every tag it emits to `props.components` as a STRING and then calls
 * it as a component; Solid's JSX compiler requires a function, so a tag missing
 * from MDX_TAGS is a runtime "Comp is not a function". The render test in
 * docs-pages.test.tsx catches that, but only as a stack trace deep inside
 * solid-js. This one names the page and the missing tag.
 *
 * It matters most when a rehype plugin starts injecting elements: adding
 * rehype-shiki introduced <span> into every page with a code block, and nothing
 * about that is obvious from the .mdx source.
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";

import { MDX_OPTIONS } from "../../plugins/mdx.ts";
import { MDX_TAG_LIST } from "./mdx-components";

const CONTENT = resolve(import.meta.dirname, "../../content/docs");

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith("_")) return [];
    const full = resolve(dir, e.name);
    if (e.isDirectory()) return pages(full);
    return e.name.endsWith(".mdx") ? [full] : [];
  });
}

/** The keys of the `_components = { … }` literal in compiled MDX output. */
function tagsUsedBy(compiled: string): string[] {
  const start = compiled.indexOf("_components = {");
  if (start === -1) return [];
  const block = compiled.slice(start, compiled.indexOf("...props.components", start));
  return [...block.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]!);
}

const FILES = pages(CONTENT);

describe("MDX tag coverage", () => {
  it("finds pages to check", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  for (const file of FILES) {
    it(`${file.replace(CONTENT + "/", "")} uses only covered tags`, async () => {
      const compiled = String(await compile(readFileSync(file), MDX_OPTIONS));
      const missing = tagsUsedBy(compiled).filter(
        (tag) => !(MDX_TAG_LIST as readonly string[]).includes(tag),
      );
      expect(missing).toEqual([]);
    });
  }
});
