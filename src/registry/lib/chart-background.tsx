import { type Component, type JSX } from "solid-js";

/**
 * Decorative SVG background patterns, drawn BEHIND the transparent ECharts
 * canvas. Shared by the pie and radial charts.
 *
 * The Recharts twin renders its pattern in SVG, so this port does the same
 * rather than trying to bake it into the canvas: an SVG layer keeps the patterns
 * crisp at any DPR and lets them pick up `text-border` from the live theme.
 *
 * Ported from EvilCharts `echarts-pie-chart.tsx` (MIT).
 *
 * ─── Solid note ────────────────────────────────────────────────────────────
 * SVG presentation attributes are written in their real, kebab-case DOM form
 * (`stroke-width`, `fill-opacity`, `fill-rule`). React's camelCase spellings
 * are a React-only convenience; in Solid they land as unknown attributes and
 * are silently ignored — the same failure mode as the legend's style keys.
 */

/**
 * Shared by the pie and radial charts. Lives in lib/ rather than beside either
 * of them because both draw the identical pattern set — duplicating 11 SVG
 * components across two charts is exactly the drift this project keeps avoiding.
 */
export type BackgroundVariant =
  | "dots"
  | "grid"
  | "cross-hatch"
  | "diagonal-lines"
  | "plus"
  | "falling-triangles"
  | "4-pointed-star"
  | "tiny-checkers"
  | "overlapping-circles"
  | "wiggle-lines"
  | "bubbles";

type PatternProps = { id: string };

export const BACKGROUND_PATTERNS: Record<BackgroundVariant, Component<PatternProps>> = {
  dots: (props) => (
    <pattern id={props.id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle class="text-border" cx="2" cy="2" r="1" fill="currentColor" />
    </pattern>
  ),
  grid: (props) => (
    <pattern id={props.id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <path
        class="text-border"
        d="M 20 0 L 0 0 0 20"
        fill="none"
        stroke="currentColor"
        stroke-width="0.5"
      />
    </pattern>
  ),
  "cross-hatch": (props) => (
    <pattern id={props.id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <path
        class="text-border/60 dark:text-border/50"
        d="M 0 0 L 20 20 M 20 0 L 0 20"
        fill="none"
        stroke="currentColor"
        stroke-width="0.5"
      />
    </pattern>
  ),
  "diagonal-lines": (props) => (
    <pattern
      id={props.id}
      x="0"
      y="0"
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line
        class="text-border"
        x1="0"
        y1="0"
        x2="0"
        y2="6"
        stroke="currentColor"
        stroke-width="0.5"
      />
    </pattern>
  ),
  plus: (props) => (
    <pattern id={props.id} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
      <path
        class="text-border"
        d="M 8 4 L 8 12 M 4 8 L 12 8"
        fill="none"
        stroke="currentColor"
        stroke-width="0.5"
        stroke-linecap="round"
      />
    </pattern>
  ),
  "falling-triangles": (props) => (
    <pattern id={props.id} x="0" y="0" width="18" height="36" patternUnits="userSpaceOnUse">
      <path
        class="text-border"
        d="M2 6h12L8 18 2 6zm18 36h12l-6 12-6-12z"
        transform="scale(0.5)"
        fill="currentColor"
        fill-opacity="0.4"
      />
    </pattern>
  ),
  "4-pointed-star": (props) => (
    <pattern id={props.id} x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
      <polygon
        class="text-border"
        fill-rule="evenodd"
        points="5 3 8 4 5 5 4 8 3 5 0 4 3 3 4 0 5 3"
        fill="currentColor"
        fill-opacity="0.4"
      />
    </pattern>
  ),
  "tiny-checkers": (props) => (
    <pattern id={props.id} x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <path
        class="text-border"
        fill-rule="evenodd"
        d="M0 0h4v4H0V0zm4 4h4v4H4V4z"
        fill="currentColor"
        fill-opacity="0.2"
      />
    </pattern>
  ),
  "overlapping-circles": (props) => (
    <pattern id={props.id} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path
        class="text-border"
        fill-rule="evenodd"
        d="M25 25c0-2.762 2.238-5 5-5s5 2.238 5 5-2.238 5-5 5c0 2.762-2.238 5-5 5s-5-2.238-5-5 2.238-5 5-5zM5 5c0-2.762 2.238-5 5-5s5 2.238 5 5-2.238 5-5 5c0 2.762-2.238 5-5 5S0 12.762 0 10s2.238-5 5-5zm5 4c2.209 0 4-1.791 4-4s-1.791-4-4-4-4 1.791-4 4 1.791 4 4 4zm20 20c2.209 0 4-1.791 4-4s-1.791-4-4-4-4 1.791-4 4 1.791 4 4 4z"
        fill="currentColor"
        fill-opacity="0.4"
      />
    </pattern>
  ),
  "wiggle-lines": (props) => (
    <pattern
      id={props.id}
      x="0"
      y="0"
      width="52"
      height="26"
      patternUnits="userSpaceOnUse"
      patternTransform="scale(0.6)"
    >
      <path
        class="text-border"
        d="M10 10c0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6h2c0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4 3.314 0 6 2.686 6 6 0 2.21 1.79 4 4 4v2c-3.314 0-6-2.686-6-6 0-2.21-1.79-4-4-4-3.314 0-6-2.686-6-6zm25.464-1.95l8.486 8.486-1.414 1.414-8.486-8.486 1.414-1.414z"
        fill="currentColor"
        fill-opacity="0.4"
      />
    </pattern>
  ),
  bubbles: (props) => (
    <pattern
      id={props.id}
      x="0"
      y="0"
      width="100"
      height="100"
      patternUnits="userSpaceOnUse"
      patternTransform="scale(0.6667)"
    >
      <path
        class="text-border"
        d="M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z"
        fill="currentColor"
        fill-opacity="0.4"
        fill-rule="evenodd"
      />
    </pattern>
  ),
};

/**
 * The pattern layer itself, with a blur-masked rect so the pattern fades out at
 * the edges instead of ending on a hard rectangle.
 *
 * `id` must be unique per instance — several pies on one page would otherwise
 * share a `<pattern>` definition, and the last one mounted would win.
 */
export function BackgroundLayer(props: {
  variant: BackgroundVariant;
  baseId: string;
}): JSX.Element {
  const patternId = () => `${props.baseId}-bg-${props.variant}`;
  const maskId = () => `${props.baseId}-bg-edge-fade`;
  const filterId = () => `${props.baseId}-bg-blur`;

  return (
    <svg
      class="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        {(() => {
          const Pattern = BACKGROUND_PATTERNS[props.variant];
          return <Pattern id={patternId()} />;
        })()}
        {/* A slightly inset white rect, blurred into a mask, leaves smooth
            transparent edges rather than a hard crop. */}
        <filter id={filterId()}>
          <feGaussianBlur stdDeviation="25" />
        </filter>
        <mask id={maskId()} maskUnits="userSpaceOnUse">
          <rect
            x="8%"
            y="20%"
            width="85%"
            height="60%"
            fill="white"
            filter={`url(#${filterId()})`}
          />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId()})`} mask={`url(#${maskId()})`} />
    </svg>
  );
}
