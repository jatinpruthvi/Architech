# Theme and control-surface findings — 2026-08-27

Reported symptom: in the light theme several buttons showed a label that was
almost invisible — "Start listing", "Read the evidence method", "Start
exploring", and the disabled "Sign & attach media" chip.

## Root cause: unlayered CSS silently disabling utilities

`client/src/index.css` carried `a { color: inherit; text-decoration: none; }`
outside any cascade layer. Tailwind v4 emits every utility inside
`@layer utilities`, and an unlayered declaration outranks any layered rule no
matter its specificity, so **every `text-*` utility on an anchor was dropped**.
A solid CTA link therefore inherited the colour of the section it sat in:

| Control | Intended | Actually rendered | Result |
| --- | --- | --- | --- |
| `bg-night text-cream` link on a plaster section | cream on near-black | inherited `--ink` | dark on dark |
| `bg-paper text-ink` link on the clay CTA band | ink on plaster | inherited `--cream` | light on light |
| `bg-brick text-cream` sidebar active item | cream on clay | inherited `--ink` | dark on clay |

23 anchors were styled as solid buttons this way and 76 anchors in total set a
palette text colour that never applied. The same rule also disabled `underline`
utilities on links. Fix: move the reset into `@layer base`, which keeps the
"links inherit by default" intent while letting utilities override it.

This is the second bug of this exact shape (the search bar's double focus ring
was the first). Any element-level rule in `index.css` that sets a property a
utility also sets must live in a layer. The remaining unlayered component
classes (`.stamp`, `.kicker`) only clash on `font-size`, which call sites
already work around with `!text-[…]`; one site was missing the `!` and rendered
11px instead of 10px (`ListingSubmission.tsx:228`).

## Contrast audit of solid surfaces

Measured from the palette tokens, against WCAG AA 4.5:1 (these labels are
11–12px bold mono, so the 3:1 large-text allowance does not apply):

| Surface | Light | Dark |
| --- | --- | --- |
| `bg-night` / `text-cream` | 16.46 | 18.04 |
| `bg-paper` / `text-ink` | 14.91 | 14.23 |
| `bg-paper` / `text-brick` | 5.34 | 4.76 |
| `bg-brick` / `text-cream` | 5.69 | **3.31 — fails** |

The dark-theme clay `#d36a48` is tuned so that clay *text* stays readable on the
dark canvas (4.78:1), which makes it too light to carry a cream label as a
*surface*. Deepening the shared token would break clay text everywhere, so
solid clay fills now opt into `.clay-fill`, which swaps only the surface to
`--brick-deep` in dark mode: **3.31 → 5.04**. The light theme is untouched.

The large clay CTA band on the homepage keeps the lighter clay: its display
heading is large text and clears the 3:1 allowance. Small copy inside that band
should be reviewed if the band ever gains 11–12px labels.

## Disabled controls

Solid actions faded to `disabled:opacity-40/45/60`. On the light plaster canvas
a faded dark button becomes a washed pink rectangle with an unreadable label —
this is what the "Sign & attach media" screenshot showed. Replaced with
`.btn-solid`, an inert chip built from the `--ink` token: 4.11:1 in light and
4.92:1 in dark, so the label stays readable while the surface clearly reads as
unavailable. The hover sweep is suppressed while disabled.

## Guards

`client/src/lib/ui/surface-contrast.test.ts` recomputes the contrast budget from
the palette, asserts the anchor reset stays layered, and fails if any solid clay
control is missing `clay-fill` or if a solid action reintroduces an opacity
fade. Verified to fail on a deliberate violation, not just pass vacuously.


## Follow-up: why the fix was not visible, and making it specificity-proof

The layered fix was correct on the server — a cascade resolver run against the
stylesheet the dev server was actually serving (layer order → specificity →
source order) showed `.text-cream` (utilities) beating `a { color: inherit }`
(base). The browser tab was still painting the old rules: Turbopack keeps a
stable stylesheet URL in dev, and a tab that was open across a server restart
loses its HMR socket, so it never refetched. A reload is required to see it.

Relying on layer order for something this load-bearing is fragile anyway, so
solid actions no longer depend on it. `.clay-fill`, `.night-fill` and
`.paper-fill` declare surface and label together as one component, unlayered:

```
.clay-fill, .night-fill { color: var(--cream); }
.paper-fill             { color: var(--ink); }
```

A class rule scores 0,1,0 against the 0,0,1 of the `a` element reset, so the
label wins on specificity **whatever layer either rule lives in** — verified by
re-running the resolver against a synthetic stylesheet where the reset is
unlayered again. Verified winners on the live CSS:

| Element | Winning rule | Value |
| --- | --- | --- |
| `a.night-fill.bg-night` | `.night-fill` (unlayered) | `var(--cream)` |
| `a.paper-fill.bg-paper` | `.paper-fill` (unlayered) | `var(--ink)` |
| `a.clay-fill.bg-brick` | `.clay-fill` (unlayered) | `var(--cream)` |

## Imagery

The evidence section and the "list your property" section were pure text. Both
now carry the site's existing editorial figure pattern (`arch-frame-sm img-hover
grain editorial-shadow` + `Pic` + a stamp caption), reusing assets already in
`public/images`: the Adalaj stepwell in a 4:5 portrait frame beside "Trust is
measured by the trail", and the brick-arch courtyard in a 4:3 frame beside the
listing CTA. No new binaries were added to the repository.
