import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { REPO_ADDRESS, buildRegistry } from "../../../scripts/build-registry.mts";
import { REGISTRY_REPO } from "./command-block";

/**
 * Docs pages name registry files by hand — `<ComponentPreview files={[…]}>` and
 * `<SourceBlock file=…>` take paths like `charts/line-chart/parts.tsx`, resolved
 * at runtime through REGISTRY_SOURCES.
 *
 * Nothing else checks those paths are real. A typo, or a rename on the registry
 * side, surfaces as "Unknown registry file" in the browser — and only for a
 * reader who clicks the Code tab on that one page. Renaming a distributed file
 * should break the build, not a page.
 *
 * The registry manifest is the right thing to check against rather than the
 * filesystem: it is what actually ships, so this also catches a file that
 * exists in the tree but was never added to an item.
 */

const DOCS = resolve(import.meta.dirname, "../../content/docs");

const REGISTERED = new Set(buildRegistry().items.flatMap((i) => i.files.map((f) => f.path)));

/** `files={["a.tsx", "b.ts"]}` and `file="c.ts"`, across every page. */
function referencesIn(source: string): string[] {
  const lists = [...source.matchAll(/\bfiles=\{\[([^\]]*)\]\}/g)].flatMap((m) =>
    [...m[1]!.matchAll(/"([^"]+)"/g)].map((q) => q[1]!),
  );
  const singles = [...source.matchAll(/\bfile="([^"]+)"/g)].map((m) => m[1]!);
  return [...lists, ...singles];
}

/** Pages nest — `charts/line-chart.mdx`, `ui/tooltip.mdx` — so this recurses. */
function pagesIn(dir: string, prefix = ""): { name: string; refs: string[] }[] {
  return readdirSync(resolve(DOCS, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return pagesIn(`${dir}/${entry.name}`, rel);
    if (!entry.name.endsWith(".mdx")) return [];
    return [{ name: rel, refs: referencesIn(readFileSync(resolve(DOCS, rel), "utf8")) }];
  });
}

const PAGES = pagesIn(".");

describe("install command", () => {
  /**
   * The docs print `owner/repo/<item>`; the registry resolves its own internal
   * dependencies through the same `owner/repo`. Two constants, and a rename
   * that updated only one would ship an install command pointing at a repo that
   * is not the one the items depend on — which fails at the reader's terminal
   * and nowhere else.
   */
  it("names the same repository the registry does", () => {
    expect(REGISTRY_REPO).toBe(REPO_ADDRESS);
  });
});

describe("docs registry references", () => {
  it("finds pages that reference registry files", () => {
    // Without this the per-page assertion below would pass vacuously.
    expect(PAGES.filter((p) => p.refs.length > 0).length).toBeGreaterThan(0);
  });

  for (const page of PAGES.filter((p) => p.refs.length > 0)) {
    it(`${page.name} names only files the registry ships`, () => {
      expect(page.refs.filter((r) => !REGISTERED.has(r))).toEqual([]);
    });
  }
});
