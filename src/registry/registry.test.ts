import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ROOT, buildRegistry, serialize } from "../../scripts/build-registry.mts";

/**
 * The registry manifests are generated, not written. These tests keep the
 * committed files honest about that.
 *
 * The drift case is the one that matters: add a chart, forget to run
 * `pnpm registry:build`, and the registry silently omits it. Nothing else
 * catches that — the app builds, the tests pass, the docs render, and the only
 * symptom is a chart nobody can install.
 */

const REGISTRY = resolve(import.meta.dirname);
const read = (p: string) => readFileSync(resolve(REGISTRY, p), "utf8");

/** Every file that ships, discovered the same way `boundary.test.ts` does. */
function walk(dir: string, prefix = ""): string[] {
  return readdirSync(resolve(REGISTRY, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return walk(`${dir}/${entry.name}`, rel);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(test|spec)\.tsx?$/.test(entry.name)) return [];
    return [rel];
  });
}

const DISTRIBUTED = [...walk("lib", "lib"), ...walk("charts", "charts")];

describe("registry manifests", () => {
  it("src/registry/registry.json matches the generator", () => {
    expect(read("registry.json")).toBe(serialize(buildRegistry()));
  });

  it("the root registry.json matches the generator", () => {
    expect(read("../../registry.json")).toBe(serialize(ROOT));
  });

  it("lists every distributed file exactly once", () => {
    const declared = buildRegistry()
      .items.flatMap((i) => i.files.map((f) => f.path))
      .sort();

    expect(new Set(declared).size).toBe(declared.length);
    expect(declared).toEqual([...DISTRIBUTED].sort());
  });

  /**
   * Caveat 5 of the distribution work, as a test.
   *
   * The charts import the shared modules as `../../lib/…` and shadcn does not
   * rewrite relative imports — it only touches alias-prefixed ones. So the
   * install targets have to reproduce the source layout's relative depth or
   * every installed copy dangles. It dangles at the consumer's `tsc`, never in
   * our CI, which is exactly why this is asserted rather than trusted.
   */
  it("targets preserve the source layout's relative depth", () => {
    for (const item of buildRegistry().items) {
      for (const file of item.files) {
        expect(file.target.endsWith(`/${file.path}`)).toBe(true);
      }
    }
  });

  it("declares no bare registry dependency", () => {
    // A bare name resolves against ui.shadcn.com, not against this registry.
    for (const item of buildRegistry().items) {
      for (const dep of item.registryDependencies ?? []) {
        expect(dep).toMatch(/\//);
      }
    }
  });

  it("carries no `--` prefix on a cssVars key", () => {
    // `{"--chart-1": …}` emits `var(----chart-1)` — four dashes, and silent.
    for (const item of buildRegistry().items) {
      for (const group of Object.values(item.cssVars ?? {})) {
        for (const key of Object.keys(group)) expect(key.startsWith("--")).toBe(false);
      }
    }
  });
});
