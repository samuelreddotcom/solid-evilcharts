/**
 * Site navigation, rendered by the root route so every page carries it.
 *
 * Lives here rather than being repeated per route: with eight chart demos
 * coming, "add the new chart to every other page's nav" is exactly the kind of
 * chore that gets skipped once.
 */
import { Link } from "@tanstack/solid-router";
import { For, type JSX } from "solid-js";

type NavItem = { to: string; label: string };

/** Charts, in the order they were ported. */
export const CHART_LINKS: NavItem[] = [
  { to: "/line-chart", label: "Line" },
  { to: "/area-chart", label: "Area" },
  { to: "/bar-chart", label: "Bar" },
  { to: "/composed-chart", label: "Composed" },
  { to: "/pie-chart", label: "Pie" },
  { to: "/radial-chart", label: "Radial" },
  { to: "/radar-chart", label: "Radar" },
  { to: "/sankey-chart", label: "Sankey" },
];

/** Not a chart — the vendored design-system component gallery. */
export const OTHER_LINKS: NavItem[] = [{ to: "/previews", label: "UI previews" }];

function NavLink(props: { to: string; children: JSX.Element }) {
  return (
    <Link
      to={props.to}
      class="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 transition-colors"
      activeProps={{ class: "text-foreground bg-muted" }}
    >
      {props.children}
    </Link>
  );
}

export function SiteNav() {
  return (
    <nav class="border-border bg-background/80 sticky top-0 z-50 border-b backdrop-blur">
      <div class="mx-auto flex max-w-3xl flex-wrap items-center gap-1 px-8 py-2 text-xs">
        <Link
          to="/"
          class="text-foreground mr-2 font-medium"
          activeOptions={{ exact: true }}
        >
          @solid-foundation/charts
        </Link>

        <For each={CHART_LINKS}>{(item) => <NavLink to={item.to}>{item.label}</NavLink>}</For>

        <span class="bg-border mx-1 h-4 w-px" aria-hidden="true" />

        <For each={OTHER_LINKS}>{(item) => <NavLink to={item.to}>{item.label}</NavLink>}</For>
      </div>
    </nav>
  );
}
