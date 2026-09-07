# Vendored UI primitives

Everything in this directory is **copied verbatim** from
[`solid-foundation-design-system`](../../../../solid-foundation-design-system)
(`src/components/ui/`). Treat it as read-only third-party code.

Vendored rather than depended on because that repo is a private, app-level Vite
project (`"private": true`) with its own release cadence. This one needs to be a
published, versioned, copy-pasteable artifact.

## Components

Vendored on **2026-09-07**, from Ark UI 5.37.

| | |
|---|---|
| Docs chrome | `button` `card` `tabs` `tooltip` `dropdown-menu` `select` `separator` `command` `accordion` `dialog` `popover` `kbd` `badge` |
| Transitive | `spinner` — required by `button` and `badge` |

`dialog` also imports `button`, already in the set.

Relative imports (`../../../lib/cn`, `../button/button`) resolve unchanged
because the directory layout mirrors upstream exactly. Do not rewrite them to
the `~/` alias — that would break a straight re-copy.

## Local deltas

Keep this list at zero wherever possible. Every entry is a merge conflict
waiting to happen on the next re-sync.

| File | Delta | Why |
|---|---|---|
| `command/command.tsx` | `setHighlighted(nav[0]!)` | This repo enables `noUncheckedIndexedAccess` (upstream doesn't) — valuable for the chart code, which indexes color arrays constantly. The access is guarded by `nav.length > 0`, which TS can't narrow through. Line 261 already uses the `?? null` form; this is the same access two lines down. Not a behaviour change. |

`verbatimModuleSyntax` is deliberately **off** in `tsconfig.json`. Turning it on
would require a type-only-import edit in `dropdown-menu` and `kbd`, buying style
rather than safety, and guaranteeing drift in every future vendored file.

## Re-syncing

```bash
SRC=../../solid-foundation-design-system/src/components/ui
for c in button card tabs tooltip dropdown-menu select separator \
         command accordion dialog popover kbd badge spinner; do
  cp -R "$SRC/$c" ./
done
```

Then re-apply the deltas above and run `pnpm build`.

## Not vendored — built here

| Component | Status |
|---|---|
| `skeleton` | Built here; upstream has none |
| `scroll-area` | Built here; upstream has none |
| `sidebar` | **Deferred to Phase 9.** Upstream has none, and a real sidebar (context, persistence, mobile sheet) is ~700 lines. Building it before the docs layout exists would be speculative. |
