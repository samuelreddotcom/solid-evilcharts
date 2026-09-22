/**
 * The site's own link tables, as data.
 *
 * Split out of `site-nav.tsx` because `scripts/build-seo.mts` needs the same
 * list to write per-route <head> tags and the sitemap, and that script is plain
 * node — importing a .tsx would drag JSX and solid-js into a post-build step.
 *
 * `site-nav.tsx` re-exports both arrays, so existing imports of them keep
 * working and there is still exactly one list.
 */
export type NavItem = {
  to: string;
  label: string;
  /** One line on what the demo actually shows. Doubles as the meta description. */
  blurb?: string;
};

/** Charts, in the order they were ported. */
export const CHART_LINKS: NavItem[] = [
  {
    to: "/line-chart",
    label: "Line",
    blurb: "Strokes, dots, brush, buffer tail, glow, hover reveal.",
  },
  {
    to: "/area-chart",
    label: "Area",
    blurb: "Seven fills, stacking, 100% stacks, controlled selection.",
  },
  {
    to: "/bar-chart",
    label: "Bar",
    blurb: "Eight fills, layout swap, post-layout measurement.",
  },
  {
    to: "/composed-chart",
    label: "Composed",
    blurb: "Bars and lines together, with two glow strategies.",
  },
  {
    to: "/pie-chart",
    label: "Pie",
    blurb: "Sector geometry, labels, 11 SVG background patterns.",
  },
  {
    to: "/radial-chart",
    label: "Radial",
    blurb: "Polar bars, gauges, semi arcs, background tracks.",
  },
  {
    to: "/radar-chart",
    label: "Radar",
    blurb: "One polygon per series, grid shapes, fill opacity.",
  },
  {
    to: "/sankey-chart",
    label: "Sankey",
    blurb: "Flow diagram with a column-by-column intro cascade.",
  },
];

/** Not a chart — the docs, and the vendored design-system component gallery. */
export const OTHER_LINKS: NavItem[] = [
  { to: "/docs/introduction", label: "Docs" },
  {
    to: "/previews",
    label: "UI previews",
    blurb: "The vendored shadcn-style primitives the docs chrome is built from.",
  },
];
