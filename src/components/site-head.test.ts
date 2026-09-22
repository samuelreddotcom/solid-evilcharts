import { beforeEach, describe, expect, it } from "vitest";

import { allRoutes, headTags } from "../../scripts/build-seo.mts";
import { documentTitle, routeFor } from "../lib/seo.ts";
import { SITE_URL } from "../lib/site.ts";
import { applyHead } from "./site-head";

/**
 * The runtime head and the prebuilt head describe the same page, so the test
 * that matters is that they agree: a client navigation must not replace the
 * served metadata with something different, and Google's JavaScript pass must
 * not see a title the crawler never got.
 */
const ROUTES = allRoutes();
const docs = routeFor(ROUTES, "/docs/charts/line-chart");
const previews = routeFor(ROUTES, "/previews");

const meta = (selector: string) =>
  document.head.querySelector<HTMLMetaElement>(selector)?.getAttribute("content");
const all = (selector: string) => document.head.querySelectorAll(selector).length;

beforeEach(() => {
  document.head.innerHTML = "";
  document.title = "";
});

describe("applyHead", () => {
  it("sets the same strings the static build writes", () => {
    applyHead(document, docs);
    expect(document.title).toBe(documentTitle(docs));
    expect(meta('meta[name="description"]')).toBe(docs.description);
    expect(meta('meta[property="og:title"]')).toBe(documentTitle(docs));
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `${SITE_URL}/docs/charts/line-chart`,
    );
    // Same image in both passes, or a shared link and a hydrated one disagree.
    expect(headTags(docs)).toContain(meta('meta[property="og:image"]')!);
  });

  it("updates rather than appends when the route changes", () => {
    applyHead(document, docs);
    applyHead(document, routeFor(ROUTES, "/"));
    expect(all('meta[name="description"]')).toBe(1);
    expect(all('meta[property="og:title"]')).toBe(1);
    expect(all('link[rel="canonical"]')).toBe(1);
    expect(document.title).toBe(documentTitle(routeFor(ROUTES, "/")));
  });

  it("adds a robots tag for the gallery and removes it on the way out", () => {
    applyHead(document, previews);
    expect(meta('meta[name="robots"]')).toBe("noindex, follow");
    applyHead(document, docs);
    expect(all('meta[name="robots"]')).toBe(0);
  });
});
