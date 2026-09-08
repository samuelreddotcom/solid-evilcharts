/**
 * Numbered install steps.
 *
 * The number comes from a CSS counter rather than an index prop, so an .mdx
 * page can add, reorder or conditionally omit a <Step> without renumbering
 * anything by hand.
 */
import type { JSX } from "solid-js";

export function Steps(props: { children: JSX.Element }) {
  return (
    <div class="[counter-reset:step] border-border ml-4 space-y-8 border-l pl-8">
      {props.children}
    </div>
  );
}

export function Step(props: { children: JSX.Element }) {
  return (
    <div class="relative [counter-increment:step]">
      <div
        class="border-border bg-muted text-foreground absolute -left-[3.25rem] flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium
               before:content-[counter(step)]"
        aria-hidden="true"
      />
      {props.children}
    </div>
  );
}

export function StepTitle(props: { children: JSX.Element }) {
  return <h3 class="mt-0 mb-2 text-base font-semibold tracking-tight">{props.children}</h3>;
}

export function StepDescription(props: { children: JSX.Element }) {
  return <div class="text-muted-foreground text-sm leading-7">{props.children}</div>;
}

export function StepContent(props: { children: JSX.Element }) {
  return <div class="mt-3">{props.children}</div>;
}
