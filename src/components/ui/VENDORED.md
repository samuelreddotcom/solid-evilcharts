# Vendored UI primitives

Everything in this directory is **copied verbatim** from
[Solid Arc](https://solid-arc.brimble.app) — the
[`solid-foundation-design-system`](../../../../solid-foundation-design-system)
repo, `src/components/ui/`. Treat it as read-only third-party code.

Vendored rather than depended on because Solid Arc is a copy-paste registry,
not a package: components are meant to live in the consuming repo as source.

## Components

Re-synced on **2026-10-13**, from Ark UI 5.37.

| | |
|---|---|
| Docs chrome | `button` `card` `tabs` `tooltip` `dropdown-menu` `select` `separator` `command` `accordion` `dialog` `popover` `kbd` `badge` `scroll-area` `skeleton` |
| Transitive | `spinner` — required by `button` and `badge` |

`dialog` also imports `button`, already in the set. `skeleton` and
`scroll-area` were first built here, then upstreamed; they now come from Solid
Arc like the rest.

## How the copies resolve

Upstream components import through the `@/` alias — `@/lib/utils` for `cn()`
and `@/components/ui/<name>/<name>` for each other — which is also what the
shadcn CLI rewrites. This repo maps `@/*` to `src/` in `tsconfig.json`,
`vite.config.ts` and `vitest.config.ts` (app code keeps using `~/*`), and
`cn()` lives at `src/lib/utils.ts`, so a straight copy compiles unchanged. Do
not rewrite the imports.

Component-specific CSS ships next to the component (`accordion/accordion.css`,
`separator/separator.css`) and is imported from `src/styles/styles.css`.
`src/styles/variants.css` is upstream's shared `data-*` variants file, copied
verbatim. The design tokens are *not* upstream's — they're EvilCharts', in
`styles.css`; `vendored-tokens.test.ts` guards that every color the copies use
exists there.

## Local deltas

**None.** Keep it that way: every delta is a merge conflict on the next
re-sync. Upstream now compiles under `noUncheckedIndexedAccess`, which was the
reason for the old `command.tsx` delta. If something here needs changing,
change it upstream and re-sync.

## Re-syncing

```bash
UP=../solid-foundation-design-system   # path to the Solid Arc repo
for c in button card tabs tooltip dropdown-menu select separator command \
         accordion dialog popover kbd badge spinner scroll-area skeleton; do
  rm -rf "src/components/ui/$c"
  cp -R "$UP/src/components/ui/$c" src/components/ui/
done
cp "$UP/src/styles/variants.css" src/styles/variants.css
```

If a newly added component ships a `.css` file, import it from
`src/styles/styles.css`. Then run `pnpm test && pnpm build` — the token test
fails if a component reaches for a color EvilCharts doesn't define.

## Not vendored

| Component | Status |
|---|---|
| `sidebar` | **Deferred to Phase 9.** Solid Arc has none, and a real sidebar (context, persistence, mobile sheet) is ~700 lines. Building it before the docs layout exists would be speculative. |
