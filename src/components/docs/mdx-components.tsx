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
import type { Component, JSX } from "solid-js";
import { Dynamic } from "solid-js/web";

import { ComponentPreview } from "./component-preview";

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

const STYLED: Record<string, Component<never>> = {
  h1: (props: Props<HTMLHeadingElement>) => (
    <h1 {...props} class="mt-2 mb-4 scroll-m-20 text-3xl font-semibold tracking-tight" />
  ),
  h2: (props: Props<HTMLHeadingElement>) => (
    <h2
      {...props}
      class="border-border mt-10 mb-4 scroll-m-20 border-b pb-2 text-xl font-semibold tracking-tight"
    />
  ),
  h3: (props: Props<HTMLHeadingElement>) => (
    <h3 {...props} class="mt-8 mb-3 scroll-m-20 text-lg font-semibold tracking-tight" />
  ),
  h4: (props: Props<HTMLHeadingElement>) => (
    <h4 {...props} class="mt-6 mb-2 scroll-m-20 font-semibold tracking-tight" />
  ),
  p: (props: Props<HTMLParagraphElement>) => (
    <p {...props} class="text-foreground/90 my-4 leading-7" />
  ),
  a: (props: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} class="text-primary font-medium underline underline-offset-4" />
  ),
  strong: (props: Props<HTMLElement>) => <strong {...props} class="font-semibold" />,
  ul: (props: Props<HTMLUListElement>) => (
    <ul {...props} class="my-4 ml-6 list-disc space-y-2" />
  ),
  ol: (props: Props<HTMLOListElement>) => (
    <ol {...props} class="my-4 ml-6 list-decimal space-y-2" />
  ),
  li: (props: Props<HTMLLIElement>) => <li {...props} class="leading-7" />,
  blockquote: (props: Props<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      class="border-border text-muted-foreground my-6 border-l-2 pl-6 italic"
    />
  ),
  hr: (props: Props<HTMLHRElement>) => <hr {...props} class="border-border my-8" />,
  img: (props: JSX.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} class="border-border my-6 rounded-lg border" />
  ),

  // Wide tables must scroll inside their own box, not push the page sideways.
  table: (props: Props<HTMLTableElement>) => (
    <div class="my-6 w-full overflow-x-auto">
      <table {...props} class="w-full border-collapse text-sm" />
    </div>
  ),
  th: (props: Props<HTMLTableCellElement>) => (
    <th {...props} class="border-border border-b px-4 py-2 text-left font-semibold" />
  ),
  td: (props: Props<HTMLTableCellElement>) => (
    <td {...props} class="border-border border-b px-4 py-2 align-top" />
  ),

  pre: (props: Props<HTMLPreElement>) => (
    <pre
      {...props}
      class="bg-muted border-border my-6 overflow-x-auto rounded-lg border p-4 text-sm"
    />
  ),
  code: (props: Props<HTMLElement>) => (
    <code
      {...props}
      class="bg-muted rounded px-[0.3rem] py-[0.2rem] font-mono text-[0.85em] [pre_&]:bg-transparent [pre_&]:p-0"
    />
  ),
};

export const mdxComponents: Record<string, Component<never>> = {
  // Available in every .mdx page without an import line.
  ComponentPreview: ComponentPreview as unknown as Component<never>,
  ...(Object.fromEntries(MDX_TAGS.map((tag) => [tag, passthrough(tag)])) as Record<
    string,
    Component<never>
  >),
  ...STYLED,
};

/** Exported for the guard test. */
export const MDX_TAG_LIST = MDX_TAGS;
