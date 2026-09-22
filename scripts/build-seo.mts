/**
 * Bakes a real <head> into a real HTML file for every route, after the build.
 *
 * The problem it solves: a Vite SPA serves one `index.html` for every URL, so
 * every page of this site shipped the same title, no description, no canonical
 * and no card image. Crawlers do not run JavaScript — Reddit, X, Discord and
 * Slack read what is served and nothing else — so every link anyone shared
 * unfurled as a bare "Solid EvilCharts" with no picture, and Google indexed
 * fifteen docs pages that looked identical and empty.
 *
 * What it does NOT do: prerender the app. The body stays `<div id="app">` and
 * hydrates exactly as before. That is deliberate — every chart here binds to a
 * canvas, so rendering the body at build time would mean client-only guards
 * around all eight of them for no crawler benefit. Heads are static; pixels
 * stay client-side.
 *
 * Run by `pnpm build` after `vite build`. `src/lib/seo.test.ts` covers the
 * pure parts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { type SiteRoute, documentTitle, siteRoutes } from "../src/lib/seo.ts";
import { OG_IMAGE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, SITE_NAME, SITE_URL } from "../src/lib/site.ts";
import { buildDocsIndex } from "../src/plugins/docs-index.ts";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = resolve(ROOT, "dist");
const DOCS_DIR = resolve(ROOT, "src/content/docs");

/**
 * The region of `index.html` this script owns.
 *
 * Markers rather than "replace the <title>": the shell carries sensible
 * defaults for `pnpm dev`, and appending a second og:title beside them would
 * leave crawlers picking whichever they read first. Replacing a delimited block
 * means the served file has exactly one of each tag, always.
 */
export const SEO_START = "<!-- seo:start -->";
export const SEO_END = "<!-- seo:end -->";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Every tag that differs per page, in the order a human would read them. */
export function headTags(route: SiteRoute): string {
  const title = documentTitle(route);
  const url = SITE_URL + route.path;
  const tags: Array<[string, string]> = [
    ["title", title],
    ["name:description", route.description],
    ["link:canonical", url],
    ["property:og:type", "website"],
    ["property:og:site_name", SITE_NAME],
    ["property:og:title", title],
    ["property:og:description", route.description],
    ["property:og:url", url],
    ["property:og:image", OG_IMAGE],
    ["property:og:image:width", String(OG_IMAGE_WIDTH)],
    ["property:og:image:height", String(OG_IMAGE_HEIGHT)],
    ["name:twitter:card", "summary_large_image"],
    ["name:twitter:title", title],
    ["name:twitter:description", route.description],
    ["name:twitter:image", OG_IMAGE],
  ];

  // Only a decision gets a robots tag; "index, follow" is the default and
  // saying it out loud just adds a line to every page. See seo.ts.
  if (!route.indexable) tags.push(["name:robots", "noindex, follow"]);

  return tags
    .map(([key, value]) => {
      const content = escape(value);
      if (key === "title") return `    <title>${content}</title>`;
      if (key === "link:canonical") return `    <link rel="canonical" href="${content}" />`;
      const [kind, ...rest] = key.split(":");
      const attr = rest.join(":");
      return `    <meta ${kind}="${attr}" content="${content}" />`;
    })
    .join("\n");
}

/** Swap the marked block in the built shell for this route's tags. */
export function injectHead(shell: string, route: SiteRoute): string {
  const start = shell.indexOf(SEO_START);
  const end = shell.indexOf(SEO_END);
  if (start === -1 || end === -1) {
    // Loud, because the silent version ships a site with no metadata at all.
    throw new Error(
      `index.html has no ${SEO_START} … ${SEO_END} block — nothing to replace. ` +
        `Restore the markers in index.html.`,
    );
  }
  return shell.slice(0, start) + SEO_START + "\n" + headTags(route) + "\n    " + shell.slice(end);
}

export function sitemapXml(routes: SiteRoute[]): string {
  const urls = routes
    .filter((route) => route.indexable)
    .map((route) => `  <url><loc>${escape(SITE_URL + route.path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function robotsTxt(routes: SiteRoute[]): string {
  const disallowed = routes
    .filter((route) => !route.indexable)
    .map((route) => `Disallow: ${route.path}`)
    .join("\n");
  return `User-agent: *
Allow: /
${disallowed}

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

/** The route table, with the docs read off disk the same way the sidebar reads them. */
export function allRoutes(): SiteRoute[] {
  return siteRoutes(buildDocsIndex(DOCS_DIR));
}

/**
 * `/` → `dist/index.html`; `/docs/x` → `dist/docs/x.html`.
 *
 * Flat files, NOT `docs/x/index.html`, and the difference is not cosmetic:
 * Cloudflare Pages canonicalises a directory index to a trailing slash and
 * 308s `/docs/x` → `/docs/x/`. Every link already shared points at the
 * slash-free form, and that is what the canonical tags and the sitemap say, so
 * a directory layout would have every page redirect to a URL its own metadata
 * disclaims. With `x.html`, Pages serves `/docs/x` directly and redirects the
 * trailing-slash form instead. Verified against `wrangler pages dev`.
 */
export function outputPath(dist: string, route: SiteRoute): string {
  return route.path === "/" ? resolve(dist, "index.html") : resolve(dist, `.${route.path}.html`);
}

if (process.argv[1] === import.meta.filename) {
  const shellPath = resolve(DIST, "index.html");
  if (!existsSync(shellPath)) {
    throw new Error(`${shellPath} does not exist — run \`vite build\` first.`);
  }

  // Read once, before the loop writes over it: the home route's output IS the
  // shell, and re-reading per route would inject into an already-injected file.
  const shell = readFileSync(shellPath, "utf8");
  const routes = allRoutes();

  for (const route of routes) {
    const target = outputPath(DIST, route);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, injectHead(shell, route));
  }

  writeFileSync(resolve(DIST, "sitemap.xml"), sitemapXml(routes));
  writeFileSync(resolve(DIST, "robots.txt"), robotsTxt(routes));

  const indexable = routes.filter((route) => route.indexable).length;
  console.log(`seo: ${routes.length} pages (${indexable} indexable), sitemap.xml, robots.txt`);
}
