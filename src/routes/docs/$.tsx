import { createFileRoute, notFound } from "@tanstack/solid-router";
import { Show, Suspense, createResource } from "solid-js";
import { Dynamic } from "solid-js/web";

import { DocsSidebar } from "../../components/docs/docs-sidebar";
import { findDocsPage } from "../../components/docs/docs-pages";
import { mdxComponents } from "../../components/docs/mdx-components";

export const Route = createFileRoute("/docs/$")({
  component: DocsPageRoute,
  loader: ({ params }) => {
    const page = findDocsPage(params._splat ?? "");
    if (!page) throw notFound();
    return { slug: page.slug };
  },
});

function DocsPageRoute() {
  const params = Route.useParams();
  const page = () => findDocsPage(params()._splat ?? "");

  // createResource keyed on the page keeps the lazy import per-slug; without
  // the key, navigating between docs pages reuses the first module.
  const [mod] = createResource(page, (p) => p.load());

  return (
    <div class="mx-auto flex w-full max-w-6xl gap-10 px-6 py-10">
      <DocsSidebar />
      <main class="min-w-0 flex-1">
        <Show when={page()}>
          {(p) => (
            <>
              <h1 class="sr-only">{p().title}</h1>
              <Suspense fallback={<p class="text-muted-foreground text-sm">Loading…</p>}>
                <Show when={mod()}>
                  {(m) => (
                    <article class="docs-prose">
                      <Dynamic component={m().default} components={mdxComponents} />
                    </article>
                  )}
                </Show>
              </Suspense>
            </>
          )}
        </Show>
      </main>
    </div>
  );
}
