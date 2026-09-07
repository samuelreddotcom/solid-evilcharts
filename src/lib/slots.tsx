/**
 * Config-as-children for Solid.
 *
 * EvilCharts' public API declares chart configuration as children:
 *
 *   <AreaChart data={data} config={cfg}>
 *     <AreaChart.Grid />
 *     <AreaChart.Area dataKey="desktop" variant="gradient">
 *       <AreaChart.Dot variant="border" />
 *     </AreaChart.Area>
 *   </AreaChart>
 *
 * React reads that back with `Children.forEach` + `isValidElement` +
 * `child.type === Area` + `child.props`. Solid has no element descriptors —
 * components are plain functions called once — so instead each marker RETURNS a
 * plain config object, and the parent resolves the children and filters for
 * them.
 *
 * Validated by the Phase 0 spike (see slots.test.tsx): nested markers,
 * reactivity through prop getters, `<Show>`, `<For>`, and junk children all
 * behave. Each chart defines its own markers and parser on top of this.
 */
import { type JSX } from "solid-js";

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
 * Builds a marker component.
 *
 * Stores the props OBJECT, never a spread. Solid props are getters, and
 * spreading here would snapshot values at creation time and permanently kill
 * reactivity — the parse memo would never see a changed `variant`. This is
 * mutation-tested; see the Gate 3 cases in slots.test.tsx.
 *
 * The `as unknown as JSX.Element` cast is the one concession to the type
 * system, and it is confined to this line. Call sites stay fully typed.
 */
export function createMarker<K extends string, P extends object>(kind: K) {
  const Marker = (props: P): JSX.Element =>
    ({ [SLOT]: kind, props }) as unknown as JSX.Element;
  Marker.kind = kind;
  return Marker;
}

/**
 * Mirrors Solid's own `resolveChildren`: zero-arg functions (memos, getters,
 * `<For>` results) are called, arrays are flattened, and nullish / boolean /
 * empty-string placeholders are dropped. Everything else — including marker
 * objects — passes straight through.
 *
 * This one function is why `<Show>` and `<For>` need no special handling.
 */
export function resolveDeep(value: unknown): unknown[] {
  if (typeof value === "function" && (value as { length: number }).length === 0) {
    return resolveDeep((value as () => unknown)());
  }
  if (Array.isArray(value)) return value.flatMap(resolveDeep);
  if (value == null || value === true || value === false || value === "") {
    return [];
  }
  return [value];
}

/** Resolves children and keeps only the markers. */
export function slotsOf(value: unknown): AnySlot[] {
  return resolveDeep(value).filter(isSlot);
}

/**
 * Reads a marker's props off a resolved slot.
 *
 * A marker that renders nothing never has its children resolved by Solid, so a
 * parser must call `slotsOf(props.children)` itself to reach nested markers.
 */
export function slotProps<P>(slot: AnySlot): P {
  return slot.props as P;
}

/** Finds the first slot of a given kind. */
export function findSlot(slots: AnySlot[], kind: string): AnySlot | undefined {
  return slots.find((slot) => slot[SLOT] === kind);
}

/** Filters slots to a given kind, preserving order. */
export function filterSlots(slots: AnySlot[], kind: string): AnySlot[] {
  return slots.filter((slot) => slot[SLOT] === kind);
}
