/**
 * The guard for the whole docs pipeline.
 *
 * It exists because of one specific failure: MDX hands every tag it emits to
 * `props.components` as a STRING, and Solid's JSX compiler calls that value as
 * a function. Any tag missing from mdxComponents is a runtime "Comp is not a
 * function" — and only on the pages that use it, so a table on one page breaks
 * while every prose page passes. Rendering every page is the only honest check.
 */
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";

import { DOCS_PAGES } from "./docs-pages";
import { MDX_TAG_LIST, mdxComponents } from "./mdx-components";

describe("mdx components", () => {
  it("maps every MDX tag to a function, never a string", () => {
    const notFunctions = MDX_TAG_LIST.filter(
      (tag) => typeof mdxComponents[tag] !== "function",
    );
    expect(notFunctions).toEqual([]);
  });
});

describe("docs pages", () => {
  it("finds pages", () => {
    // A registry that silently resolved to nothing would make the per-page
    // assertions below vacuous.
    expect(DOCS_PAGES.length).toBeGreaterThan(0);
  });

  it("gives every page a title", () => {
    expect(DOCS_PAGES.filter((p) => !p.title)).toEqual([]);
  });

  for (const page of DOCS_PAGES) {
    it(`renders ${page.slug} without throwing`, async () => {
      const mod = await page.load();
      expect(typeof mod.default).toBe("function");

      const host = document.createElement("div");
      document.body.append(host);
      const dispose = render(
        () => mod.default({ components: mdxComponents }),
        host,
      );

      // Not just "didn't throw" — a page that mounted empty is also broken.
      expect(host.textContent?.trim()).not.toBe("");

      dispose();
      host.remove();
    });
  }
});
