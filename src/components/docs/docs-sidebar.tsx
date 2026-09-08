/** Docs navigation. Driven by the same registry the routes use, so a new .mdx
 *  file appears here without an edit. */
import { Link } from "@tanstack/solid-router";
import { For } from "solid-js";

import { DOCS_PAGES } from "./docs-pages";

export function DocsSidebar() {
  return (
    <nav class="hidden w-48 shrink-0 md:block" aria-label="Docs">
      <ul class="sticky top-(--docs-sticky-top) space-y-1 text-sm">
        <For each={DOCS_PAGES}>
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
    </nav>
  );
}
