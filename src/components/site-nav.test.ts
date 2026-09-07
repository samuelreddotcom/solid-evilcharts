import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CHART_LINKS, OTHER_LINKS } from "./site-nav";

/**
 * The nav exists so that adding a chart doesn't mean editing every other page.
 * This guards the other half of that: adding a chart ROUTE and forgetting the
 * nav entry, which would leave the demo reachable only by typing the URL.
 *
 * Deliberately filesystem-driven rather than a hardcoded list — a hardcoded one
 * would need the same manual update it is meant to catch.
 */
const ROUTES_DIR = join(import.meta.dirname, "../routes");

/** Route files that are not chart demos. */
const NON_CHART_ROUTES = new Set(["__root", "index", "previews"]);

const routeNames = readdirSync(ROUTES_DIR)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => file.replace(/\.tsx$/, ""));

const chartRoutes = routeNames.filter((name) => !NON_CHART_ROUTES.has(name));

describe("site nav", () => {
  it("finds the chart routes on disk (guards against the scan matching nothing)", () => {
    expect(chartRoutes.length).toBeGreaterThan(0);
  });

  it("links to every chart route", () => {
    const linked = new Set(CHART_LINKS.map((item) => item.to.replace(/^\//, "")));
    const missing = chartRoutes.filter((name) => !linked.has(name));
    expect(missing, "chart routes with no nav entry").toEqual([]);
  });

  it("links to nothing that does not exist", () => {
    const onDisk = new Set(routeNames);
    const broken = [...CHART_LINKS, ...OTHER_LINKS]
      .map((item) => item.to.replace(/^\//, ""))
      .filter((name) => !onDisk.has(name));
    expect(broken, "nav entries with no route file").toEqual([]);
  });

  it("gives every entry a label and an absolute path", () => {
    for (const item of [...CHART_LINKS, ...OTHER_LINKS]) {
      expect(item.label.length, item.to).toBeGreaterThan(0);
      expect(item.to.startsWith("/"), item.to).toBe(true);
    }
  });
});
