import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FALLBACK_SERIES_COLOR,
  PROBE_CLASSES,
  THEMES,
  THEME_KEYS,
  buildChartCss,
  distributeColors,
  flattenColor,
  getColorsCount,
  indicatorBackground,
  normalizeColor,
  resolveColors,
  withAlpha,
  type ChartConfig,
} from "./chart-tokens";

describe("the split itself", () => {
  // This is the load-bearing assertion of Phase 3. chart-tokens.ts exists so a
  // second rendering engine can consume it unchanged; the moment it imports
  // echarts, that stops being true and the TanStack engine becomes a rewrite.
  const source = readFileSync(resolve(import.meta.dirname, "./chart-tokens.ts"), "utf8");
  const imports = [...source.matchAll(/^import[\s\S]*?from\s+"([^"]+)"/gm)].map(
    (m) => m[1]!,
  );

  it("chart-tokens imports no charting engine", () => {
    expect(imports.filter((i) => i.includes("echarts"))).toEqual([]);
  });

  it("chart-tokens imports nothing at runtime — types only", () => {
    const runtimeImports = [...source.matchAll(/^import\s+(?!type\b)[\s\S]*?from/gm)];
    expect(runtimeImports).toEqual([]);
    expect(imports).toEqual(["solid-js"]);
  });
});

describe("getColorsCount", () => {
  it("defaults to 1 when a series declares no colours", () => {
    expect(getColorsCount({})).toBe(1);
  });

  it("takes the longest array across themes", () => {
    expect(getColorsCount({ colors: { light: ["a", "b", "c"], dark: ["z"] } })).toBe(3);
    expect(getColorsCount({ colors: { light: ["a"], dark: ["x", "y"] } })).toBe(2);
  });

  it("never returns 0 for an empty array", () => {
    expect(getColorsCount({ colors: { light: [] } })).toBe(1);
  });
});

describe("distributeColors", () => {
  it("gives extra slots to the LAST colours", () => {
    expect(distributeColors(["c0", "c1"], 4)).toEqual(["c0", "c0", "c1", "c1"]);
    expect(distributeColors(["c0", "c1", "c2"], 4)).toEqual(["c0", "c1", "c2", "c2"]);
  });

  it("truncates when there are already enough colours", () => {
    expect(distributeColors(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(distributeColors(["a"], 1)).toEqual(["a"]);
  });

  it("always returns exactly maxCount slots", () => {
    for (let available = 1; available <= 5; available++) {
      for (let max = 1; max <= 8; max++) {
        const colors = Array.from({ length: available }, (_, i) => `c${i}`);
        expect(distributeColors(colors, max)).toHaveLength(max);
      }
    }
  });
});

describe("buildChartCss", () => {
  const config: ChartConfig = {
    desktop: { colors: { light: ["#0a0"], dark: ["#0f0"] } },
    mobile: { colors: { light: ["#a00", "#f00"] } },
  };

  it("emits a light block scoped to [data-chart] and a .dark block", () => {
    const css = buildChartCss("abc", config);
    expect(css).toContain("[data-chart=abc] {");
    expect(css).toContain(".dark [data-chart=abc] {");
  });

  it("numbers the slots per series", () => {
    const css = buildChartCss("abc", config);
    expect(css).toContain("--color-desktop-0: #0a0;");
    expect(css).toContain("--color-desktop-0: #0f0;");
    expect(css).toContain("--color-mobile-0: #a00;");
    expect(css).toContain("--color-mobile-1: #f00;");
  });

  it("omits a series from the theme that doesn't declare it", () => {
    // mobile is light-only, so the dark block carries no mobile vars.
    const darkBlock = buildChartCss("abc", config).split(".dark [data-chart=abc] {")[1]!;
    expect(darkBlock).not.toContain("--color-mobile");
  });

  it("returns empty string when no series declares colours", () => {
    expect(buildChartCss("abc", { desktop: { label: "Desktop" } })).toBe("");
  });
});

describe("withAlpha", () => {
  it("MULTIPLIES the existing alpha rather than replacing it", () => {
    // The whole point: dark mode's --border is already 7.5% white. Replacing
    // would blow the grid lines out to 50%.
    expect(withAlpha("rgba(255, 255, 255, 0.1)", 0.5)).toBe("rgba(255, 255, 255, 0.050)");
  });

  it("treats a missing alpha as 1", () => {
    expect(withAlpha("rgb(10, 20, 30)", 0.5)).toBe("rgba(10, 20, 30, 0.500)");
  });

  it("passes non-rgb input through untouched", () => {
    expect(withAlpha("oklch(0.5 0 0)", 0.5)).toBe("oklch(0.5 0 0)");
  });
});

describe("flattenColor", () => {
  it("composites a translucent colour over an opaque base", () => {
    expect(flattenColor("rgba(255, 0, 0, 0.5)", "rgb(0, 0, 0)")).toBe("rgb(128, 0, 0)");
    expect(flattenColor("rgba(0, 0, 0, 0.5)", "rgb(255, 255, 255)")).toBe(
      "rgb(128, 128, 128)",
    );
  });

  it("returns the colour itself when fully opaque", () => {
    expect(flattenColor("rgba(12, 34, 56, 1)", "rgb(255, 255, 255)")).toBe(
      "rgb(12, 34, 56)",
    );
  });

  it("returns the base when fully transparent", () => {
    expect(flattenColor("rgba(12, 34, 56, 0)", "rgb(255, 255, 255)")).toBe(
      "rgb(255, 255, 255)",
    );
  });
});

describe("indicatorBackground", () => {
  it("uses a bare var for a single colour", () => {
    expect(indicatorBackground("desktop", 1)).toBe("var(--color-desktop-0)");
    expect(indicatorBackground("desktop", 0)).toBe("var(--color-desktop-0)");
  });

  it("spreads stops evenly across a gradient", () => {
    expect(indicatorBackground("desktop", 3)).toBe(
      "linear-gradient(to right, var(--color-desktop-0) 0%, " +
        "var(--color-desktop-1) 50%, var(--color-desktop-2) 100%)",
    );
  });
});

describe("normalizeColor", () => {
  // jsdom ships no canvas, so getContext("2d") returns null and the function
  // degrades to returning its input. Asserting the fallback is the honest test
  // here; real normalisation needs a browser.
  it("returns the input untouched when no 2D context is available", () => {
    expect(normalizeColor("oklch(0.5 0 0)")).toBe("oklch(0.5 0 0)");
    expect(normalizeColor("  #abc  ")).toBe("#abc");
  });

  it("returns empty input untouched", () => {
    expect(normalizeColor("")).toBe("");
  });
});

describe("theme keys", () => {
  it("maps light to the bare root and dark to .dark", () => {
    expect(THEMES).toEqual({ light: "", dark: ".dark" });
    expect(THEME_KEYS).toEqual(["light", "dark"]);
  });
});

describe("resolveColors", () => {
  it("falls back to grey for a series with no var defined", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const resolved = resolveColors(host, { desktop: {} }, ["desktop"]);

    expect(resolved.series.desktop).toEqual([FALLBACK_SERIES_COLOR]);
    host.remove();
  });

  it("allocates one slot per colour the config declares", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const config: ChartConfig = { desktop: { colors: { light: ["a", "b", "c"] } } };
    const resolved = resolveColors(host, config, ["desktop"]);

    expect(resolved.series.desktop).toHaveLength(3);
    host.remove();
  });

  it("cleans up its probe span", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    resolveColors(host, { desktop: {} }, ["desktop"]);

    expect(host.childElementCount).toBe(0);
    host.remove();
  });

  it("returns all four theme tokens", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);

    const { tokens } = resolveColors(host, {}, []);

    expect(Object.keys(tokens).sort()).toEqual([
      "background",
      "border",
      "foreground",
      "mutedForeground",
    ]);
    host.remove();
  });

  it("probes the same class names styles.css is asserted against", () => {
    expect(Object.values(PROBE_CLASSES)).toEqual([
      "text-muted-foreground",
      "text-border",
      "text-foreground",
      "text-background",
    ]);
  });
});
