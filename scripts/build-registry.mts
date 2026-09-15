import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Generates the two `registry.json` files from the directory tree.
 *
 * Run it with `pnpm registry:build`; `registry.test.ts` asserts the committed
 * file still matches what this produces, so a chart added without regenerating
 * fails CI rather than shipping a registry that omits it.
 *
 * Why the file is generated rather than hand-written: the `files` arrays are
 * ~60 entries whose `target` paths must mirror the source layout exactly. That
 * is caveat 5 of the distribution work — the charts import the shared modules
 * as `../../lib/…`, and shadcn does not rewrite relative imports. If `lib/` and
 * `charts/<name>/` do not land two levels apart in the consumer, every
 * installed copy breaks, and it breaks at the consumer's `tsc`, never here.
 */

const REGISTRY = resolve(import.meta.dirname, "../src/registry");

/**
 * Where installed files land, relative to the consumer's project root.
 *
 * NOT the `@components/` target placeholder from the shadcn docs: that is
 * documented but absent from the CLI as shipped (4.21.0 contains no occurrence
 * of it), so an explicit path is the only form that works today. Revisit when a
 * release actually carries the placeholders — it would let the install respect
 * a consumer's configured components directory instead of hardcoding one.
 */
const INSTALL_ROOT = "components/solid-charts";

/**
 * The GitHub item address other items resolve dependencies through.
 *
 * A bare `"charts-core"` would resolve against ui.shadcn.com, not against this
 * registry — that is the trap this constant exists to avoid. Change the two
 * fields below and every dependency edge follows.
 */
const OWNER = "thesambayo";
const REPO = "solid-evilcharts";
const itemAddress = (name: string) => `${OWNER}/${REPO}/${name}`;

/** `owner/repo` — the prefix of every install command the docs print. */
export const REPO_ADDRESS = `${OWNER}/${REPO}`;

/**
 * Where the root registry.json lives, and what it points at.
 *
 * The items are declared in `src/registry/registry.json` rather than here so
 * their `path` fields are relative to the registry subtree — `charts/line-chart/
 * parts.tsx`, the same vocabulary `REGISTRY_SOURCES` keys the docs on. One
 * rename then breaks the registry and the docs together, which is the point.
 */
const ROOT_REGISTRY = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: REPO,
  homepage: `https://github.com/${OWNER}/${REPO}`,
  include: ["src/registry/registry.json"],
};

/** The whole runtime surface, pinned identically by `boundary.test.ts`. */
const DEPENDENCIES = ["echarts", "solid-js"];

type RegistryFile = { path: string; type: string; target: string };
type RegistryItem = {
  name: string;
  type: string;
  title: string;
  description: string;
  dependencies: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
  cssVars?: Record<string, Record<string, string>>;
};

/** Distributed source files in a directory: no tests, sorted for a stable diff. */
function sourcesIn(dir: string): string[] {
  return readdirSync(resolve(REGISTRY, dir))
    .filter((f) => /\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f))
    .sort();
}

/** `line-chart` → `Line Chart` */
function titleCase(name: string): string {
  return name
    .split("-")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * The chart palette, shipped with the shared modules so a chart looks right the
 * moment it is installed.
 *
 * Keys carry NO `--` prefix. `{"--chart-1": …}` emits `var(----chart-1)` — four
 * dashes, silently broken, and nothing warns. Verified both ways.
 */
const CSS_VARS = {
  light: {
    "chart-1": "oklch(0.646 0.222 41.116)",
    "chart-2": "oklch(0.6 0.118 184.704)",
    "chart-3": "oklch(0.398 0.07 227.392)",
    "chart-4": "oklch(0.828 0.189 84.429)",
    "chart-5": "oklch(0.769 0.188 70.08)",
  },
  dark: {
    "chart-1": "oklch(0.488 0.243 264.376)",
    "chart-2": "oklch(0.696 0.17 162.48)",
    "chart-3": "oklch(0.769 0.188 70.08)",
    "chart-4": "oklch(0.627 0.265 303.9)",
    "chart-5": "oklch(0.645 0.246 16.439)",
  },
};

function coreItem(): RegistryItem {
  return {
    name: "charts-core",
    type: "registry:lib",
    title: "Charts Core",
    description:
      "Shared chart primitives: colour tokens, series helpers, slots, and the ECharts tooltip, legend, dot, brush and paint modules. Installed automatically by every chart.",
    dependencies: DEPENDENCIES,
    files: sourcesIn("lib").map((f) => ({
      path: `lib/${f}`,
      type: "registry:lib",
      target: `${INSTALL_ROOT}/lib/${f}`,
    })),
    cssVars: CSS_VARS,
  };
}

function chartItem(name: string): RegistryItem {
  return {
    name,
    type: "registry:component",
    title: titleCase(name),
    description: `A Solid ${titleCase(name).toLowerCase()} built on Apache ECharts.`,
    dependencies: DEPENDENCIES,
    registryDependencies: [itemAddress("charts-core")],
    files: sourcesIn(`charts/${name}`).map((f) => ({
      path: `charts/${name}/${f}`,
      type: "registry:component",
      target: `${INSTALL_ROOT}/charts/${name}/${f}`,
    })),
  };
}

export function buildRegistry() {
  const charts = readdirSync(resolve(REGISTRY, "charts"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    items: [coreItem(), ...charts.map(chartItem)],
  };
}

/** Trailing newline so the file is diff-clean against `git diff` and editors. */
export const serialize = (r: unknown) => `${JSON.stringify(r, null, 2)}\n`;

export const ROOT = ROOT_REGISTRY;

if (process.argv[1] === import.meta.filename) {
  for (const [path, content] of [
    [resolve(REGISTRY, "registry.json"), buildRegistry()],
    [resolve(REGISTRY, "../../registry.json"), ROOT_REGISTRY],
  ] as const) {
    writeFileSync(path, serialize(content));
    console.log(`wrote ${path}`);
  }
}
