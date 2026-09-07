import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every semantic color utility used by a vendored component must resolve to a
 * token this repo actually defines.
 *
 * This exists because the vendored components come from
 * solid-foundation-design-system but the tokens come from EvilCharts, and the
 * two vocabularies are not the same. On the first vendoring pass this caught
 * `bg-brand`, `bg-success` and `bg-warning` — real in the design system, absent
 * from EvilCharts — which would have rendered Button's brand variant and three
 * Badge variants with no background at all.
 *
 * Re-run after vendoring anything new. A failure means either add the token to
 * styles.css or drop the variant.
 */

const UI_DIR = import.meta.dirname;
const CSS = readFileSync(resolve(UI_DIR, "../../styles/styles.css"), "utf8");

const COLOR_PREFIXES =
  "bg|text|border|ring|fill|stroke|outline|from|to|via|divide|caret|decoration|shadow|accent";

/** Tailwind built-ins and non-color suffixes that share the utility prefixes. */
const NOT_TOKENS = new Set([
  // Palette names — available without a custom token.
  "red", "blue", "green", "yellow", "orange", "purple", "pink", "gray", "slate",
  "zinc", "neutral", "stone", "amber", "lime", "emerald", "teal", "cyan", "sky",
  "indigo", "violet", "fuchsia", "rose",
  // Keywords.
  "current", "transparent", "inherit", "initial", "white", "black", "none",
  "auto", "solid", "dashed", "dotted", "double", "hidden", "clip-padding",
  // Sizing / position / typography suffixes that collide with the prefixes,
  // e.g. text-base, border-b-2, shadow-xs, slide-in-from-top-2.
  "base", "xs", "sm", "md", "lg", "xl", "full", "px", "clip", "ellipsis",
  "wrap", "nowrap", "balance", "pretty", "words", "break", "word",
  "center", "left", "right", "start", "end", "top", "bottom",
  "b", "t", "l", "r", "x", "y", "s", "e",
]);

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

/** Strips comments so prose ("…from the start…") can't look like a utility. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

const definedTokens = new Set(
  [...CSS.matchAll(/^\s*(--color-[a-z0-9-]+)\s*:/gim)].map((m) =>
    m[1]!.replace("--color-", ""),
  ),
);

const referenced = new Map<string, string>(); // token -> first file seen in

for (const file of tsxFiles(UI_DIR)) {
  const source = stripComments(readFileSync(file, "utf8"));
  const pattern = new RegExp(`\\b(?:${COLOR_PREFIXES})-([a-z][a-z0-9-]*)`, "g");
  for (const match of source.matchAll(pattern)) {
    const token = match[1]!.split("/")[0]!.replace(/-\d+$/, "");
    if (NOT_TOKENS.has(token)) continue;
    if (/^\d/.test(token)) continue;
    if (!referenced.has(token)) referenced.set(token, file.replace(UI_DIR, "ui"));
  }
}

describe("vendored components only use tokens we define", () => {
  it("finds tokens to check (guards against the scan silently matching nothing)", () => {
    expect(referenced.size).toBeGreaterThan(5);
    expect(definedTokens.size).toBeGreaterThan(20);
  });

  it("references no undefined color token", () => {
    const undefinedTokens = [...referenced.entries()]
      .filter(([token]) => !definedTokens.has(token))
      .map(([token, file]) => `${token} (${file})`);

    expect(undefinedTokens).toEqual([]);
  });

  it.each(["brand", "brand-foreground", "success", "warning"])(
    "%s is defined — added for the vendored components, absent from EvilCharts",
    (token) => {
      expect(definedTokens.has(token)).toBe(true);
    },
  );
});
