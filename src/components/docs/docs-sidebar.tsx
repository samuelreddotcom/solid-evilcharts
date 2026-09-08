/**
 * Docs navigation.
 *
 * Driven by the same registry the routes use, so a new .mdx file appears here
 * without an edit. Order and grouping come from each page's frontmatter
 * (`order`, `group`) — see src/plugins/docs-index.ts.
 */
import { For, Show } from "solid-js";
import { Link } from "@tanstack/solid-router";

import { docsSections } from "./docs-pages";

export function DocsSidebar() {
  const sections = docsSections();

  return (
    <nav class="hidden w-52 shrink-0 md:block" aria-label="Docs">
      <div class="sticky top-(--docs-sticky-top) space-y-6">
        <For each={sections}>
          {(section) => (
            <div>
              <Show when={section.group}>
                {(group) => (
                  <p class="text-foreground mb-2 px-2 text-xs font-semibold tracking-wide uppercase">
                    {group()}
                  </p>
                )}
              </Show>
              <ul class="space-y-1 text-sm">
                <For each={section.pages}>
                  {(page) => (
                    <li>
                      <Link
                        to="/docs/$"
                        params={{ _splat: page.slug }}
                        class="text-muted-foreground hover:text-foreground block rounded-md px-2 py-1 transition-colors"
                        activeProps={{ class: "text-foreground bg-muted" }}
                      >
                        {page.title}
                      </Link>
                    </li>
                  )}
                </For>
              </ul>
            </div>
          )}
        </For>
      </div>
    </nav>
  );
}
