const DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;

/**
 * Dev-only warnings for the failure modes that otherwise render SILENTLY.
 *
 * Every warning here covers a mistake that produces a chart which draws
 * without throwing, and simply looks wrong: a grey series, a missing texture,
 * absent labels. Those cost a reader an afternoon precisely because nothing
 * points at them. `tsc` cannot catch any of them — they are all value-level.
 *
 * ── Why `(import.meta as …).env?.DEV` and not `import.meta.env.DEV` ──
 *
 * This file is DISTRIBUTED. It is copied into a project whose bundler we do
 * not know and whose tsconfig may not reference `vite/client`, so:
 *
 *   - the inline cast supplies the type locally, needing no ambient `ImportMeta`
 *     augmentation in the consumer;
 *   - `?.` means a bundler that leaves `import.meta.env` undefined yields
 *     `undefined` rather than throwing `TypeError`, so warnings are simply off.
 *
 * Both matter for stripping, which was verified against Vite 8 rather than
 * assumed. `(import.meta as …).env?.DEV` in a module-scope const folds to
 * `false` and every `warnOnce` body below is eliminated. What does NOT survive
 * that test is aliasing import.meta first — `const M = import.meta; M.env?.DEV`
 * defeats the define and ships the warnings to production. Keep the cast inline
 * in the initialiser.
 */

/** Keys already warned about, so a reactive re-render cannot flood the console. */
const warned = new Set<string>();

function warnOnce(key: string, lines: string[]): void {
  if (!DEV) return;
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(lines.join("\n"));
}

/** Test-only: the dedupe cache is module state and would leak between cases. */
export function resetDevWarnings(): void {
  warned.clear();
}

/**
 * A series key with no `config` entry at all.
 *
 * Deliberately NOT "the CSS var resolved to grey" — that is the same symptom
 * but a much noisier signal, true of every call under jsdom and of any call
 * made before the chart's <style> has painted. An absent key is unambiguous.
 *
 * The common cause is the pie/radial divergence: those two key `config` by
 * SECTOR NAME, while the cartesian charts key it by series column. Printing
 * both sets side by side makes that visible without a trip to the docs.
 */
export function warnUnconfiguredKeys(keys: string[], config: object): void {
  const missing = keys.filter((key) => !(key in config));
  if (!missing.length) return;

  const provided = Object.keys(config);
  warnOnce(`config:${missing.join(",")}|${provided.join(",")}`, [
    `[solid-evilcharts] No \`config\` entry for: ${missing.map((k) => `"${k}"`).join(", ")}`,
    `  config provides: ${provided.length ? provided.join(", ") : "(nothing)"}`,
    `  chart asked for: ${keys.join(", ")}`,
    `  Those series fall back to grey. Pie and radial key \`config\` by sector`,
    `  name, not by series key — check which one this chart expects.`,
  ]);
}

/**
 * A pattern fill asked for under the SVG renderer.
 *
 * These variants are painted onto a tiling <canvas> and handed to ECharts as
 * an image pattern, which the SVG renderer cannot draw. It does not error; the
 * series just comes out flat, so the variant silently appears not to work.
 */
export function warnCanvasOnlyVariants(
  chart: string,
  renderer: string,
  variants: string[],
  canvasOnly: readonly string[],
): void {
  if (renderer !== "svg") return;
  const affected = [...new Set(variants.filter((v) => canvasOnly.includes(v)))];
  if (!affected.length) return;

  warnOnce(`canvas-only:${chart}:${affected.join(",")}`, [
    `[solid-evilcharts] ${chart}: ${affected.map((v) => `"${v}"`).join(", ")} ` +
      `${affected.length === 1 ? "is a canvas-only fill" : "are canvas-only fills"} ` +
      `and renders flat under \`renderer="svg"\`.`,
    `  Drop the \`renderer\` prop to use the canvas default, or pick another variant.`,
  ]);
}

/**
 * `<NodeLabel>` with no `position`.
 *
 * Unlike every other slot prop in the sankey chart, this one has no default —
 * omit it and ECharts is handed `undefined`, which renders no labels at all.
 * The chart otherwise looks entirely healthy.
 */
export function warnMissingNodeLabelPosition(): void {
  warnOnce("sankey:nodelabel-position", [
    `[solid-evilcharts] <NodeLabel> has no \`position\`, so no labels will render.`,
    `  It is the one slot prop here with no default. Pass e.g. position="right".`,
  ]);
}
