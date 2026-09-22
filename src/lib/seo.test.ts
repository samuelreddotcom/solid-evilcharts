import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  SEO_END,
  SEO_START,
  allRoutes,
  headTags,
  injectHead,
  outputPath,
  robotsTxt,
  sitemapXml,
} from "../../scripts/build-seo.mts";
import { buildDocsIndex } from "../plugins/docs-index.ts";
import { CHART_LINKS } from "./nav.ts";
import { documentTitle, routeFor } from "./seo.ts";
import { SITE_URL } from "./site.ts";

/**
 * The failure these guard against is invisible from inside the app: a page
 * that renders perfectly and is worthless to every crawler. Nothing in the
 * build notices a missing description, a duplicated og:title, or a new docs
 * page that never reached the sitemap — the site just quietly stops being
 * shareable, one page at a time.
 */

const ROOT = resolve(import.meta.dirname, "../..");
const SHELL = readFileSync(resolve(ROOT, "index.html"), "utf8");
const DOCS = buildDocsIndex(resolve(ROOT, "src/content/docs"));
const ROUTES = allRoutes();

/** Counts non-overlapping occurrences — duplicates are the whole risk here. */
const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("the route table", () => {
  it("found the docs on disk (or every assertion below is vacuous)", () => {
    expect(DOCS.length).toBeGreaterThan(0);
    expect(ROUTES.length).toBeGreaterThan(DOCS.length);
  });

  it("has an entry for every docs page", () => {
    const paths = new Set(ROUTES.map((route) => route.path));
    const missing = DOCS.filter((page) => !paths.has(`/docs/${page.slug}`));
    expect(
      missing.map((page) => page.slug),
      "docs pages with no route entry",
    ).toEqual([]);
  });

  it("has an entry for every chart demo", () => {
    const paths = new Set(ROUTES.map((route) => route.path));
    const missing = CHART_LINKS.filter((chart) => !paths.has(chart.to));
    expect(
      missing.map((chart) => chart.to),
      "chart routes with no route entry",
    ).toEqual([]);
  });

  it("gives every route a unique, absolute, slash-free-ending path", () => {
    const paths = ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path.startsWith("/"), path).toBe(true);
      expect(path === "/" || !path.endsWith("/"), path).toBe(true);
    }
  });

  it("gives every route a real description, not the site tagline by accident", () => {
    // A docs page that forgets `description:` in its frontmatter falls back to
    // the tagline, which ships fifteen identical <meta name="description">.
    const undescribed = DOCS.filter((page) => !page.description);
    expect(
      undescribed.map((page) => page.slug),
      "docs pages missing frontmatter description",
    ).toEqual([]);
  });

  it("keeps the UI gallery out of the index", () => {
    const previews = ROUTES.find((route) => route.path === "/previews");
    expect(previews?.indexable).toBe(false);
  });
});

describe("titles", () => {
  it("suffixes every page but the home page", () => {
    const home = routeFor(ROUTES, "/");
    const docs = routeFor(ROUTES, "/docs/introduction");
    expect(documentTitle(home)).toBe("Solid EvilCharts — charts for SolidJS");
    expect(documentTitle(docs)).toBe(`${docs.title} — Solid EvilCharts`);
  });

  it("resolves a trailing slash, and falls back to home for anything unknown", () => {
    expect(routeFor(ROUTES, "/docs/introduction/").path).toBe("/docs/introduction");
    expect(routeFor(ROUTES, "/nope").path).toBe("/");
  });
});

describe("head injection", () => {
  const route = routeFor(ROUTES, "/docs/charts/line-chart");
  const page = injectHead(SHELL, route);

  it("index.html still carries the markers the script replaces", () => {
    expect(SHELL).toContain(SEO_START);
    expect(SHELL).toContain(SEO_END);
  });

  it("leaves exactly one of each tag", () => {
    for (const tag of ["<title>", 'property="og:title"', 'rel="canonical"', 'name="description"']) {
      expect(occurrences(page, tag), tag).toBe(1);
    }
  });

  it("writes this route's own title, description and canonical", () => {
    expect(page).toContain(`<title>${documentTitle(route)}</title>`);
    expect(page).toContain(`content="${route.description}"`);
    expect(page).toContain(`href="${SITE_URL}/docs/charts/line-chart"`);
  });

  it("keeps the app's script tag and mount point intact", () => {
    expect(page).toContain('<div id="app">');
    expect(occurrences(page, "<script")).toBe(occurrences(SHELL, "<script"));
  });

  it("escapes markup in a description rather than emitting it", () => {
    const tags = headTags({
      path: "/x",
      title: 'A "quoted" <b>title</b>',
      description: "Bars & lines",
      indexable: true,
    });
    expect(tags).toContain("&quot;quoted&quot;");
    expect(tags).toContain("&lt;b&gt;");
    expect(tags).toContain("Bars &amp; lines");
  });

  it("marks a non-indexable route noindex, and leaves indexable ones unmarked", () => {
    expect(headTags(routeFor(ROUTES, "/previews"))).toContain('content="noindex, follow"');
    expect(headTags(routeFor(ROUTES, "/"))).not.toContain('name="robots"');
  });

  it("says loudly when the markers are gone", () => {
    expect(() => injectHead("<html><head></head></html>", route)).toThrow(/seo:start/);
  });
});

describe("sitemap and robots", () => {
  const sitemap = sitemapXml(ROUTES);

  it("lists every indexable route, absolutely", () => {
    for (const route of ROUTES.filter((r) => r.indexable)) {
      expect(sitemap).toContain(`<loc>${SITE_URL}${route.path}</loc>`);
    }
  });

  it("lists nothing that opted out", () => {
    expect(sitemap).not.toContain("/previews");
  });

  it("points robots.txt at the sitemap and disallows the opt-outs", () => {
    const robots = robotsTxt(ROUTES);
    expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(robots).toContain("Disallow: /previews");
  });
});

describe("output paths", () => {
  it("writes the home route as the shell itself, and others as flat .html files", () => {
    expect(outputPath("/dist", routeFor(ROUTES, "/"))).toBe("/dist/index.html");
    // Not `line-chart/index.html` — that form makes Cloudflare Pages 308 to a
    // trailing slash the canonical tag denies. See outputPath's comment.
    expect(outputPath("/dist", routeFor(ROUTES, "/docs/charts/line-chart"))).toBe(
      "/dist/docs/charts/line-chart.html",
    );
  });
});
