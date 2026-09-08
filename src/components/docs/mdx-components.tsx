/**
 * Element overrides handed to every compiled MDX page.
 *
 * ─── Read this before adding a tag ─────────────────────────────────────────
 * MDX defaults every tag it emits to a STRING:
 *
 *   const _components = { p: "p", tbody: "tbody", ...props.components };
 *   return <_components.tbody>…</_components.tbody>
 *
 * React's createElement takes a string happily. Solid's JSX compiler does not:
 * a member-expression tag compiles to `createComponent(Comp, props)`, which
 * calls Comp. A string blows up at runtime with the memorably unhelpful
 *
 *   Comp is not a function
 *
 * and it blows up per-PAGE, only for the tags that page happens to use — so a
 * page with a table breaks while every prose page passes. That is why the map
 * below is built from MDX_TAGS rather than hand-listed: every tag MDX can emit
 * gets a function, and the styled ones override it. Missing one is a runtime
 * crash, not a styling nit.
 *
 * Guarded by docs-pages.test.tsx, which renders every page.
 *
 * No MDXProvider: `solid-mdx` is at 0.0.7 and unmaintained, and passing
 * `components` explicitly costs one prop at the single call site.
 */
import { Show, splitProps } from "solid-js";
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

import { cn } from "../../lib/cn";

import { ApiHeading, ApiRow, ApiTable } from "./api-table";
import { Callout } from "./callout";
import { CommandBlock } from "./command-block";
import { ComponentPreview } from "./component-preview";
import { CopyButton } from "./copy-button";
import { SourceBlock } from "./source-block";
import { Step, StepContent, StepDescription, StepTitle, Steps } from "./steps";

type Props<T = HTMLElement> = JSX.HTMLAttributes<T> & { children?: JSX.Element };

/**
 * Every HTML tag an MDX page can ask for. Anything here that isn't styled below
 * still renders — just unstyled, which is a far better failure than a white
 * screen.
 *
 * This is deliberately WIDER than markdown's own element set, because rehype
 * plugins inject their own: rehype-shiki turns every fenced block into nested
 * `<span>`s, and a `<span>` missing from this list is a runtime crash on any
 * page with a code block. Assume the next plugin does something similar.
 * `mdx-tags.test.ts` compiles each page and checks this list against what the
 * page actually asks for, so the failure is a clear message rather than
 * "Comp is not a function".
 */
const MDX_TAGS = [
  // markdown + GFM
  "a", "blockquote", "br", "code", "del", "em",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "img", "input", "li", "ol", "p", "pre",
  "section", "strong", "sup",
  "table", "tbody", "td", "th", "thead", "tr", "ul",
  // injected by rehype plugins, or usable directly in a page's own JSX
  "span", "div", "sub", "small", "kbd", "mark", "abbr", "b", "i", "s", "u",
  "dl", "dt", "dd", "details", "summary", "figure", "figcaption",
  "picture", "source", "video", "iframe",
] as const;

/** A component that renders the tag itself — the safety net, not the styling. */
function passthrough(tag: string): Component<Record<string, unknown>> {
  return (props) => <Dynamic component={tag} {...props} />;
}

/**
 * Merge our styling with whatever class the markup already carried.
 *
 * `<pre {...props} class="…" />` looks harmless and is not: in Solid the later
 * `class` REPLACES the spread one. For most markdown tags nothing arrives with
 * a class and the bug is invisible — but Shiki puts `class="shiki shiki-themes
 * min-light vesper"` on its <pre>, and the entire dual-theme colour scheme
 * hangs off that `.shiki` selector. Losing it renders the block in the
 * inherited body colour: no error, no warning, just uncoloured code that looks
 * like it was never highlighted.
 *
 * Guarded by docs-pages.test.tsx.
 */
function styled<T extends HTMLElement>(
  tag: string,
  classes: string,
): Component<Props<T>> {
  return (props) => {
    const [local, rest] = splitProps(props as { class?: string }, ["class"]);
    return <Dynamic component={tag} {...rest} class={cn(classes, local.class)} />;
  };
}

const STYLED: Record<string, Component<never>> = {
  h1: styled("h1", "mt-2 mb-4 scroll-m-20 text-3xl font-semibold tracking-tight"),
  h2: styled(
    "h2",
    "border-border mt-10 mb-4 scroll-m-20 border-b pb-2 text-xl font-semibold tracking-tight",
  ),
  h3: styled("h3", "mt-8 mb-3 scroll-m-20 text-lg font-semibold tracking-tight"),
  h4: styled("h4", "mt-6 mb-2 scroll-m-20 font-semibold tracking-tight"),
  p: styled("p", "text-foreground/90 my-4 leading-7"),
  a: styled("a", "text-primary font-medium underline underline-offset-4"),
  strong: styled("strong", "font-semibold"),
  ul: styled("ul", "my-4 ml-6 list-disc space-y-2"),
  ol: styled("ol", "my-4 ml-6 list-decimal space-y-2"),
  li: styled("li", "leading-7"),
  blockquote: styled(
    "blockquote",
    "border-border text-muted-foreground my-6 border-l-2 pl-6 italic",
  ),
  hr: styled("hr", "border-border my-8"),
  img: styled("img", "border-border my-6 rounded-lg border"),
  th: styled("th", "border-border border-b px-4 py-2 text-left font-semibold"),
  td: styled("td", "border-border border-b px-4 py-2 align-top"),
  code: styled(
    "code",
    "bg-muted rounded px-[0.3rem] py-[0.2rem] font-mono text-[0.85em] [pre_&]:bg-transparent [pre_&]:p-0",
  ),

  // Wide tables must scroll inside their own box, not push the page sideways.
  table: (props: Props<HTMLTableElement>) => {
    const [local, rest] = splitProps(props as { class?: string }, ["class"]);
    return (
      <div class="my-6 w-full overflow-x-auto">
        <table {...rest} class={cn("w-full border-collapse text-sm", local.class)} />
      </div>
    );
  },

  // Shiki already emits a fully styled <pre> — including the `.shiki` class the
  // theme CSS keys off. This only adds the frame and the copy button, and must
  // MERGE its classes rather than replace them. `data-code` carries the
  // pre-highlight source; see the keep-source-for-copy transformer in
  // plugins/mdx.ts.
  pre: (props: Props<HTMLPreElement> & { "data-code"?: string }) => {
    const [local, rest] = splitProps(props as { class?: string; "data-code"?: string }, [
      "class",
      "data-code",
    ]);
    return (
      <div class="border-border relative my-6 overflow-hidden rounded-lg border">
        <Show when={local["data-code"]}>
          {(code) => (
            <div class="absolute top-2 right-2 z-10">
              <CopyButton value={code()} />
            </div>
          )}
        </Show>
        <pre {...rest} class={cn("overflow-x-auto text-sm", local.class)} />
      </div>
    );
  },
};

export const mdxComponents: Record<string, Component<never>> = {
  // Available in every .mdx page without an import line. The casts are because
  // the map is typed for HTML tags; these take their own props.
  ...({
    ApiHeading,
    ApiRow,
    ApiTable,
    Callout,
    CommandBlock,
    ComponentPreview,
    SourceBlock,
    Step,
    StepContent,
    StepDescription,
    StepTitle,
    Steps,
  } as unknown as Record<string, Component<never>>),
  ...(Object.fromEntries(MDX_TAGS.map((tag) => [tag, passthrough(tag)])) as Record<
    string,
    Component<never>
  >),
  ...STYLED,
};

/** Exported for the guard test. */
export const MDX_TAG_LIST = MDX_TAGS;
