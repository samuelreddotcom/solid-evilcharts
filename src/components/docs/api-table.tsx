/**
 * Props reference tables.
 *
 * A real <table> rather than a grid of divs: it is tabular data, it should be
 * announced as such, and it should still be readable when the CSS fails.
 */
import type { JSX } from "solid-js";
import { Show } from "solid-js";

export function ApiHeading(props: { children: JSX.Element }) {
  return (
    <h3 class="mt-8 mb-3 scroll-m-20 font-mono text-base font-semibold tracking-tight">
      {props.children}
    </h3>
  );
}

export function ApiTable(props: { children: JSX.Element }) {
  return (
    <div class="border-border my-4 w-full overflow-x-auto rounded-lg border">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-muted/40">
            <th class="border-border border-b px-4 py-2 text-left font-semibold">Prop</th>
            <th class="border-border border-b px-4 py-2 text-left font-semibold">Type</th>
            <th class="border-border border-b px-4 py-2 text-left font-semibold">Default</th>
            <th class="border-border border-b px-4 py-2 text-left font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  );
}

export function ApiRow(props: {
  name: string;
  type: string;
  default?: string;
  required?: boolean;
  children?: JSX.Element;
}) {
  return (
    <tr>
      <td class="border-border border-b px-4 py-2 align-top">
        <code class="font-mono text-[0.85em] whitespace-nowrap">{props.name}</code>
        <Show when={props.required}>
          <span class="text-destructive ml-1" title="required">
            *
          </span>
        </Show>
      </td>
      <td class="border-border text-muted-foreground border-b px-4 py-2 align-top">
        <code class="font-mono text-[0.85em]">{props.type}</code>
      </td>
      <td class="border-border text-muted-foreground border-b px-4 py-2 align-top">
        <Show when={props.default} fallback={<span aria-hidden="true">—</span>}>
          {(d) => <code class="font-mono text-[0.85em]">{d()}</code>}
        </Show>
      </td>
      <td class="border-border border-b px-4 py-2 align-top">{props.children}</td>
    </tr>
  );
}
