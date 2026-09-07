/**
 * Phase 0 spike: config-as-children for Solid.
 *
 * React version (evilcharts) inspects `child.type` / `child.props` via
 * Children.forEach + isValidElement. Solid has no element descriptors, so
 * markers return a plain config object instead of JSX and the parent resolves
 * them.
 */
import { children, type JSX } from "solid-js";

export const SLOT = Symbol("chart-slot");

export type Slot<K extends string, P> = {
  readonly [SLOT]: K;
  readonly props: P;
};

export type AnySlot = Slot<string, Record<string, unknown>>;

export function isSlot(value: unknown): value is AnySlot {
  return typeof value === "object" && value !== null && SLOT in value;
}

/**
 * Builds a marker component. Note it stores the props OBJECT, never a spread —
 * Solid props are getters, and spreading here would snapshot values at creation
 * time and permanently kill reactivity.
 */
export function createMarker<K extends string, P extends object>(kind: K) {
  const Marker = (props: P): JSX.Element =>
    ({ [SLOT]: kind, props }) as unknown as JSX.Element;
  Marker.kind = kind;
  return Marker;
}

/**
 * Mirrors Solid's own `resolveChildren`: zero-arg functions (memos, getters,
 * <For> results) are called, arrays are flattened, nullish/boolean/empty-string
 * placeholders are dropped. Everything else — including our marker objects —
 * passes straight through.
 */
export function resolveDeep(value: unknown): unknown[] {
  if (typeof value === "function" && (value as Function).length === 0) {
    return resolveDeep((value as () => unknown)());
  }
  if (Array.isArray(value)) return value.flatMap(resolveDeep);
  if (value == null || value === true || value === false || value === "") {
    return [];
  }
  return [value];
}

export function slotsOf(value: unknown): AnySlot[] {
  return resolveDeep(value).filter(isSlot);
}

// ── Chart markers ────────────────────────────────────────────────────────────

export type DotProps = { variant?: string };
export type AreaProps = {
  dataKey: string;
  variant?: string;
  children?: JSX.Element;
};
export type XAxisProps = { dataKey: string; tickFormatter?: (v: string) => string };

export const Dot = createMarker<"dot", DotProps>("dot");
export const ActiveDot = createMarker<"activeDot", DotProps>("activeDot");
export const Area = createMarker<"area", AreaProps>("area");
export const XAxis = createMarker<"xAxis", XAxisProps>("xAxis");
export const Grid = createMarker<"grid", Record<string, never>>("grid");

// ── Parser ───────────────────────────────────────────────────────────────────

export type ParsedArea = {
  dataKey: string;
  variant: string;
  dotVariant: string;
  activeDotVariant: string;
};

export type Parsed = {
  areas: ParsedArea[];
  xAxis: { dataKey: string; tickFormatter?: (v: string) => string } | null;
  showGrid: boolean;
};

export function parseSlots(resolved: unknown): Parsed {
  const out: Parsed = { areas: [], xAxis: null, showGrid: false };

  for (const slot of slotsOf(resolved)) {
    switch (slot[SLOT]) {
      case "area": {
        const props = slot.props as AreaProps;
        // Area never renders, so its children were never resolved by Solid.
        // Reading props.children fires the getter; resolveDeep handles the rest.
        const nested = slotsOf(props.children);
        const dot = nested.find((s) => s[SLOT] === "dot");
        const activeDot = nested.find((s) => s[SLOT] === "activeDot");
        out.areas.push({
          dataKey: props.dataKey,
          variant: props.variant ?? "gradient",
          dotVariant: (dot?.props as DotProps | undefined)?.variant ?? "none",
          activeDotVariant:
            (activeDot?.props as DotProps | undefined)?.variant ?? "none",
        });
        break;
      }
      case "xAxis": {
        const props = slot.props as XAxisProps;
        out.xAxis = { dataKey: props.dataKey, tickFormatter: props.tickFormatter };
        break;
      }
      case "grid":
        out.showGrid = true;
        break;
    }
  }

  return out;
}

/**
 * Stand-in for the real chart shell. Exposes the parse result through a callback
 * so the spike can assert on it without a DOM.
 */
export function Chart(props: {
  children?: JSX.Element;
  onParse: (parsed: Parsed) => void;
}): JSX.Element {
  const resolved = children(() => props.children);
  // createMemo semantics come free via children(); re-reads on dependency change.
  const parsed = () => parseSlots(resolved());
  props.onParse(parsed());
  return null as unknown as JSX.Element;
}
