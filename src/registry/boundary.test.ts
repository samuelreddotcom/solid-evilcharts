import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The registry boundary.
 *
 * Everything under `src/registry/` is DISTRIBUTED — `shadcn add` copies these
 * files verbatim into someone else's project, where `src/routes`,
 * `src/components/ui` and `src/lib/cn.ts` do not exist. An import that reaches
 * outside this directory compiles fine here and breaks every installed copy,
 * and it breaks it at the consumer's `tsc`, never in our CI. Hence this test.
 *
 * Two things are asserted:
 *
 * 1. No relative import escapes `src/registry/`.
 * 2. The set of bare (node_modules) specifiers is EXACTLY the list below.
 *
 * (2) is the load-bearing half. That list is the registry's `dependencies`
 * array — the packages `shadcn add` installs into the consumer. Adding a
 * runtime import without declaring it there ships a chart that cannot resolve
 * its own imports, so this test makes adding one a deliberate act.
 */

const REGISTRY = resolve(import.meta.dirname);

/**
 * Packages a distributed file may import. Keep in sync with registry.json.
 *
 * Note what is NOT here: `solid-js/web` (tests only, for `render`), and
 * `clsx` / `tailwind-merge` (only `src/lib/cn.ts` wants those, and it stayed
 * outside the registry). The whole runtime surface is echarts + solid-js.
 */
const ALLOWED_PACKAGES = [
  "echarts/charts",
  "echarts/components",
  "echarts/core",
  "echarts/renderers",
  "solid-js",
] as const;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    // Tests are not distributed, so they are free to import whatever they like.
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

/**
 * Both import forms, plus `export … from`, plus bare side-effect imports.
 * Deliberately regex rather than a real parser: this must see the file the way
 * a reader does, not the way a bundler does.
 */
function specifiersOf(source: string): string[] {
  const fromClause = [...source.matchAll(/^(?:import|export)\b[\s\S]*?\sfrom\s+"([^"]+)"/gm)];
  const sideEffect = [...source.matchAll(/^import\s+"([^"]+)"/gm)];
  return [...fromClause, ...sideEffect].map((m) => m[1]!);
}

const FILES = walk(REGISTRY);

describe("registry boundary", () => {
  it("finds the distributed files", () => {
    // A glob that silently matches nothing would make every assertion vacuous.
    expect(FILES.length).toBeGreaterThan(20);
  });

  it("no relative import escapes src/registry", () => {
    const escapes: string[] = [];
    for (const file of FILES) {
      for (const spec of specifiersOf(readFileSync(file, "utf8"))) {
        if (!spec.startsWith(".")) continue;
        const target = resolve(dirname(file), spec);
        if (!target.startsWith(REGISTRY + "/")) {
          escapes.push(`${relative(REGISTRY, file)} → ${spec}`);
        }
      }
    }
    expect(escapes).toEqual([]);
  });

  it("imports no packages beyond the declared dependency list", () => {
    const used = new Set<string>();
    for (const file of FILES) {
      for (const spec of specifiersOf(readFileSync(file, "utf8"))) {
        if (!spec.startsWith(".")) used.add(spec);
      }
    }
    expect([...used].sort()).toEqual([...ALLOWED_PACKAGES]);
  });

  it("ships no `cn` — the vendored UI owns that, and it is not distributed", () => {
    // src/lib/cn.ts deliberately stayed outside the registry: only
    // src/components/ui/** uses it, so the registry needs neither the file nor
    // clsx/tailwind-merge in its dependency list.
    const offenders = FILES.filter((f) => /\bcn\(/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(REGISTRY, f))).toEqual([]);
  });
});
