/**
 * Every distributed file, lazily loadable as highlighted HTML.
 *
 * The glob is keyed on paths relative to src/registry, which is the same
 * vocabulary registry.json uses for its `files[].path` — so a docs page names a
 * file the same way the registry does, and a rename breaks both together rather
 * than leaving the docs quietly pointing at nothing.
 *
 * `query: "?shiki"` routes each file through src/plugins/shiki.ts, so what
 * arrives is pre-rendered markup plus the raw source for the copy button.
 * Nothing here pulls Shiki into the browser.
 */
type SourceModule = { html: string; code: string };

// Tests are excluded IN THE PATTERN, not by a later .filter(). import.meta.glob
// is resolved at build time, so a runtime filter still leaves Vite emitting a
// chunk per test file — 24 of them, and some are hundreds of kB of highlighted
// markup for code that is never distributed.
const GLOB = import.meta.glob<SourceModule>(
  ["../../registry/**/*.{ts,tsx}", "!../../registry/**/*.{test,spec}.{ts,tsx}"],
  { query: "?shiki" },
);

/** `../../registry/charts/line-chart/parts.tsx` → `charts/line-chart/parts.tsx` */
function toRegistryPath(globKey: string): string {
  return globKey.replace(/^.*\/registry\//, "");
}

export const REGISTRY_SOURCES: Record<string, () => Promise<SourceModule>> = Object.fromEntries(
  Object.entries(GLOB).map(([key, load]) => [toRegistryPath(key), load]),
);

/** The tab label for a file: its basename is enough to tell them apart. */
export function sourceLabel(registryPath: string): string {
  return registryPath.split("/").pop() ?? registryPath;
}
