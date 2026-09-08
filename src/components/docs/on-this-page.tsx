/**
 * "On This Page".
 *
 * Headings come from virtual:docs-index — parsed off disk at build time — not
 * from querying the DOM after render. Reading the DOM would work, but it means
 * the list can only appear after the page mounts, and it would race the lazy
 * MDX chunk. The ids are produced with the same github-slugger rehype-slug
 * uses, so the anchors match.
 */
import { For, Show } from "solid-js";
import type { DocsHeading } from "virtual:docs-index";

export function OnThisPage(props: { headings: DocsHeading[] }) {
  return (
    <Show when={props.headings.length > 0}>
      <nav class="hidden w-48 shrink-0 xl:block" aria-label="On this page">
        <div class="sticky top-(--docs-sticky-top)">
          <p class="text-foreground mb-2 text-sm font-semibold">On this page</p>
          <ul class="space-y-1 text-sm">
            <For each={props.headings}>
              {(h) => (
                <li>
                  <a
                    href={`#${h.id}`}
                    class="text-muted-foreground hover:text-foreground block py-0.5 transition-colors"
                    classList={{ "pl-3": h.depth === 3 }}
                  >
                    {h.text}
                  </a>
                </li>
              )}
            </For>
          </ul>
        </div>
      </nav>
    </Show>
  );
}
