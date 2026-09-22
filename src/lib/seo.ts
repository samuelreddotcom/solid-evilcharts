/**
 * One route table, two consumers.
 *
 * `scripts/build-seo.mts` walks it after `vite build` and writes a real HTML
 * file per route with the right <head> baked in; `site-head.tsx` reads the same
 * table at runtime and keeps the live document in step as you navigate.
 *
 * Why both: crawlers do not run JavaScript. Reddit, X, Discord, Slack and
 * Google's first pass all read the HTML as served — and a Vite SPA serves the
 * same 800-byte shell for every URL, so every link shared anywhere carried one
 * title, no description and no image. The static pass fixes what crawlers see;
 * the runtime pass fixes the browser tab. They must agree, which is why neither
 * side owns the strings.
 */
import { CHART_LINKS, OTHER_LINKS } from "./nav.ts";
import { SITE_NAME, SITE_TAGLINE } from "./site.ts";

/** The subset of a docs-index entry this module needs. */
export type DocsMeta = { slug: string; title: string; description?: string };

export type SiteRoute = {
  /** Absolute, no trailing slash (except "/"). */
  path: string;
  title: string;
  description: string;
  /** In the sitemap, and crawlable. Thin pages opt out rather than mislead. */
  indexable: boolean;
};

/** "Line Chart" → "Line Chart — Solid EvilCharts"; the home title stands alone. */
export function documentTitle(route: SiteRoute): string {
  return route.path === "/" ? `${SITE_NAME} — charts for SolidJS` : `${route.title} — ${SITE_NAME}`;
}

/**
 * Every URL the site answers with real content, built from the same tables the
 * nav and the docs sidebar use.
 *
 * Adding a chart or an .mdx page therefore adds a sitemap entry and a prebuilt
 * <head> for free — the failure mode this avoids is a new page that is live,
 * linked, and invisible to every crawler because nobody remembered a list.
 */
export function siteRoutes(docs: DocsMeta[]): SiteRoute[] {
  const home: SiteRoute = {
    path: "/",
    title: SITE_NAME,
    description: SITE_TAGLINE,
    indexable: true,
  };

  const docsRoutes = docs.map((page) => ({
    path: `/docs/${page.slug}`,
    title: page.title,
    description: page.description ?? SITE_TAGLINE,
    indexable: true,
  }));

  const chartRoutes = CHART_LINKS.map((chart) => ({
    path: chart.to,
    title: `${chart.label} chart demo`,
    description: chart.blurb ?? SITE_TAGLINE,
    indexable: true,
  }));

  // `/previews` is a gallery of vendored UI primitives — useful to us, not
  // something anyone should land on from a search for Solid charts.
  const previews = OTHER_LINKS.filter((item) => item.to === "/previews").map((item) => ({
    path: item.to,
    title: item.label,
    description: item.blurb ?? SITE_TAGLINE,
    indexable: false,
  }));

  return [home, ...docsRoutes, ...chartRoutes, ...previews];
}

/**
 * The route for a pathname, or the home entry as a fallback.
 *
 * A trailing slash is tolerated because Cloudflare Pages will happily serve
 * `/docs/introduction/` and a visitor who types it should still get the right
 * title rather than the site's default one.
 */
export function routeFor(routes: SiteRoute[], pathname: string): SiteRoute {
  const wanted = pathname.length > 1 ? pathname.replace(/\/+$/, "") : "/";
  return routes.find((route) => route.path === wanted) ?? routes[0]!;
}
