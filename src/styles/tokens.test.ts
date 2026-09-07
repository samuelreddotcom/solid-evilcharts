import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the token contract the chart code depends on.
 *
 * These assertions are deliberately static — they parse styles.css rather than
 * rendering it. jsdom cannot compute `oklch()` or resolve `var()` chains, so a
 * getComputedStyle-based test here would pass while telling us nothing. The
 * real end-to-end check (resolveColors reading live values off a probe span)
 * lands in Phase 4 against a browser.
 *
 * What this DOES catch is the actual regression risk: someone edits the token
 * blocks and drops a dark counterpart, or renames the dark selector.
 */

const CSS = readFileSync(resolve(import.meta.dirname, "./styles.css"), "utf8");

/** Pulls a top-level `selector { … }` block's body out of the stylesheet. */
function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`missing block: ${selector}`);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}") {
      depth--;
      if (depth === 0) return CSS.slice(open + 1, i);
    }
  }
  throw new Error(`unterminated block: ${selector}`);
}

function tokensIn(body: string): Set<string> {
  return new Set(
    [...body.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]!),
  );
}

const light = tokensIn(block(":root"));
const dark = tokensIn(block(".dark"));

/**
 * resolveColors() paints a probe span with each of these classes and reads
 * getComputedStyle().color. Tailwind resolves `text-<name>` via
 * `--color-<name>`, which we alias to the raw `--<name>` token.
 */
const PROBE_TOKENS = [
  "--muted-foreground",
  "--border",
  "--foreground",
  "--background",
] as const;

describe("chart-critical tokens", () => {
  it.each(PROBE_TOKENS)("%s is defined in light", (token) => {
    expect(light.has(token)).toBe(true);
  });

  it.each(PROBE_TOKENS)("%s is defined in dark", (token) => {
    expect(dark.has(token)).toBe(true);
  });

  it.each(PROBE_TOKENS)("%s is aliased into @theme as --color-*", (token) => {
    const alias = token.replace("--", "--color-");
    expect(CSS).toContain(`${alias}: var(${token});`);
  });
});

describe("dark selector", () => {
  it("stays `.dark` — chart code hardcodes THEMES.dark = '.dark'", () => {
    expect(CSS).toMatch(/^\.dark \{/m);
    expect(CSS).toContain("@custom-variant dark (&:is(.dark *));");
  });
});

describe("light/dark parity", () => {
  // --radius and --selection* are structural, not themed; upstream defines
  // --selection in both, --radius only in :root.
  const LIGHT_ONLY = new Set(["--radius"]);

  it("every light token has a dark counterpart", () => {
    const missing = [...light].filter(
      (token) => !LIGHT_ONLY.has(token) && !dark.has(token),
    );
    expect(missing).toEqual([]);
  });

  it("dark introduces no tokens light lacks", () => {
    const extra = [...dark].filter((token) => !light.has(token));
    expect(extra).toEqual([]);
  });

  it("ports the full upstream token set, not a subset", () => {
    // EvilCharts' :root carries 40 tokens (excluding the two --color-vesper-*
    // Shiki entries, which are docs-only and live with the code theme).
    expect(light.size).toBeGreaterThanOrEqual(40);
  });
});
