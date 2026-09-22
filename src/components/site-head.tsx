/**
 * Keeps the live document's <head> in step with the route.
 *
 * The static pass in `scripts/build-seo.mts` is what crawlers read; this is
 * what the browser tab, the history entry and Google's JavaScript pass read.
 * Both take their strings from `~/lib/seo`, so a page cannot end up with one
 * title in the served HTML and another after hydration.
 *
 * Tags are upserted rather than assumed: the prebuilt file for a route already
 * carries them, but a client-side navigation lands on a document built for a
 * different URL, and `/previews` (the only noindex route) has to be able to add
 * a robots tag that the page before it did not have.
 */
import { useRouterState } from "@tanstack/solid-router";
import { createEffect } from "solid-js";

import { type SiteRoute, documentTitle, routeFor, siteRoutes } from "../lib/seo";
import { OG_IMAGE, SITE_URL } from "../lib/site";
import { DOCS_PAGES } from "./docs/docs-pages";

const ROUTES = siteRoutes(DOCS_PAGES);

/** `<meta name="…">` — description, robots, twitter:*. */
function setNamed(doc: Document, name: string, content: string | undefined) {
  const existing = doc.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (content === undefined) {
    existing?.remove();
    return;
  }
  const tag = existing ?? doc.head.appendChild(doc.createElement("meta"));
  tag.setAttribute("name", name);
  tag.setAttribute("content", content);
}

/** `<meta property="og:…">` — Open Graph uses `property`, not `name`. */
function setProperty(doc: Document, property: string, content: string) {
  const existing = doc.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  const tag = existing ?? doc.head.appendChild(doc.createElement("meta"));
  tag.setAttribute("property", property);
  tag.setAttribute("content", content);
}

function setCanonical(doc: Document, href: string) {
  const existing = doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const tag = existing ?? doc.head.appendChild(doc.createElement("link"));
  tag.setAttribute("rel", "canonical");
  tag.setAttribute("href", href);
}

/** Exported for the test: the whole head update as one pure-ish function. */
export function applyHead(doc: Document, route: SiteRoute) {
  const title = documentTitle(route);
  const url = SITE_URL + route.path;

  doc.title = title;
  setNamed(doc, "description", route.description);
  // Absent, not "index" — a robots tag saying index is noise; one saying
  // noindex is a decision, and only `/previews` makes it.
  setNamed(doc, "robots", route.indexable ? undefined : "noindex, follow");

  setProperty(doc, "og:title", title);
  setProperty(doc, "og:description", route.description);
  setProperty(doc, "og:url", url);
  setProperty(doc, "og:image", OG_IMAGE);

  setNamed(doc, "twitter:title", title);
  setNamed(doc, "twitter:description", route.description);
  setNamed(doc, "twitter:image", OG_IMAGE);

  setCanonical(doc, url);
}

export function SiteHead() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  createEffect(() => {
    applyHead(document, routeFor(ROUTES, pathname()));
  });

  return null;
}
