# Theme — Aurora Glass

**Date:** 13 September 2026
**Request:** Rebuild the UI to match two supplied reference screenshots (a luminous
multi-colour aurora field with frosted glass panels).
**Supersedes:** Saffron Survey (the drafting-board atlas). Supersedes the earlier
Chisfis re-skin in `docs/ui/chisfis-theme.md`, which this does not resemble: that was a
cool indigo/teal *palette* swap, this is a change of visual world.

## What the reference asked for

Both screenshots share one structure: a soft high-key mesh gradient — magenta top-left,
violet left, blue through the centre, teal bottom-right, warm gold top-right — rendered
pastel, with **frosted white glass panels floating on top**. Panels carry a lit 1px edge,
a soft tinted drop shadow, generous corner radii (~20–24px), and small coloured tag chips
with white labels. Typography is a clean grotesk in near-black, sentence case, restrained.

## The transfer

The reference is a light, luminous interface. The product was **night-first** with a dark
default; matching the reference meant making it **day-first**. `ThemeContext` now lands on
light, and `scrolled` in the header still deepens the glass on scroll.

### Palette

Every value was checked against WCAG AA before being written, with the ratios that the
contrast audits now enforce:

| Token | Light | Dark | Role |
|---|---|---|---|
| `--ink` | `#221c2e` | `#ede9fe` | near-black violet text (15.2:1 / 15.5:1 on canvas) |
| `--paper` | `#f7f4fc` | `#14112b` | canvas base under the mesh |
| `--brick` | `#6d28d9` | `#c4b5fd` | violet action (6.5:1 text / 7.1:1 white-on-fill) |
| `--brick-deep` | `#5b21b6` | `#4c1d95` | pressed fill; stays **dark** in dark theme so cream labels keep 10.9:1 |
| `--ember` | `#b01baf` | `#f0abfc` | magenta tag (5.3:1 text / 5.8:1 white-on-fill) |
| `--trust` | `#0f766e` | `#5eead4` | teal verification |
| `--gold` | `#a16207` | `#fcd34d` | warm gold tag (4.9:1 white-on-fill) |
| `--muted-foreground` | `#5b5270` | `#a99fc4` | body-copy floor (6.7:1 / 7.4:1) |

`--ember` is the one value chosen purely by measurement: the reference's magenta
(`#c026d3`) lands at 4.33:1 on the canvas, below AA. `#b01baf` keeps the hue and reaches
5.33:1.

### The canvas

The aurora is a `body::before` layer — five radial gradients over a linear base, in both
themes. It is deliberately a **fixed pseudo-element rather than
`background-attachment: fixed`**, which forces a full-canvas repaint every scroll frame on
mobile. Colour concentrates at the edges and washes out through the middle: that pale
centre is what keeps body copy readable and what the glass refracts.

### Glass

`.glass` / `.glass-sm` / `.glass-lg` / `.glass-tab` in `theme.css` are the material:
translucent fill, lit edge, violet-tinted drop, top inner highlight. `@supports` gives an
opaque tint where `backdrop-filter` is unavailable.

**Translucency is kept out of the token map on purpose.** `ops/scripts/audit-surface-contrast.mjs`
resolves opaque hex tokens and *silently skips* anything it cannot resolve — so routing
glass through `--paper` would have quietly disabled contrast checking for every surface it
touches. Glass lives in its own classes instead, with its contrast checked by hand
(ink on glass 14.4:1, muted-on-glass 6.4:1 over the palest region).

### Type and radius

- `.stamp` / `.stamp-sm` replace the previous free-for-all. **216 call sites** had been
  overriding `.stamp` downward with `!text-[9px|10px|11px]`; the floor is now 11px.
- `.display em` no longer sets `color: var(--brick)`. Emphasis in headings is
  typographic (weight), not chromatic — the same violet device had been repeated at 81
  sites.
- `.arch-frame` lost its chamfered `clip-path` survey-window cut for the same radius
  family as the glass. `.grain` is now bare noise (the drafting grid and topographic rings
  fought the canvas). `.kicker` became a glass pill with a lit dot.

## Deliberate non-changes

- **No new dependencies.** The mesh, glass, and chips are CSS.
- **Route structure, SEO, sitemap, JSON-LD, URL state, keyboard combobox behaviour and
  reduced-motion coverage are untouched.** `theme.css:952+` still neutralises every
  animated motif, including `.search-spring-in { opacity: 1 }` — without which the hero
  search is invisible under `prefers-reduced-motion: reduce`.
- **The `clay-fill` contract was kept, not worked around.** Four new violet buttons first
  omitted it; `pnpm test` caught that cream-on-light-violet would fail in dark mode.
  Adding `clay-fill` back is the fix, not relaxing the test.

## Verification

```
pnpm verify        all 13 gates pass
pnpm audit:contrast ✓ both themes
pnpm audit:mobile   14/14 routes · 0 overflow · 0 tap-risk
pnpm test:seo       19 routes, 8 sitemaps, 2 AI-index files, 525 URLs, 0 errors
pnpm test           216 files / 2278 tests
```

Two guardrails were updated rather than deleted, each with a comment recording why:
`src/lib/ui/field-focus.test.ts` pinned the hero focus ring to `--ember` (now the tag
colour, not the action colour), and the i18n stat labels claimed "RERA-checked" beside a
hardcoded `100%`.

## Known follow-ups

1. The social/OG card image (`public/images/hero-glow.*`) still shows the golden-hour
   world, so `layout.tsx`'s `alt` text still says "golden hour". Asset regeneration needed.
2. Brand imagery in `public/images/` is warm/saffron and now sits off-palette inside an
   aurora canvas.
3. `.desk-*` surfaces (29 usages, internal/broker screens) still carry the old
   survey-desk treatment.
4. ~37 arbitrary `!text-[10px]`/`[11px]` sizes remain on non-`stamp` elements.
