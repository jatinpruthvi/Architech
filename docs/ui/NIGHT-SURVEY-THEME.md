# Saffron Survey — Architech's design language

> **Current direction (v4 — warm saffron-forward, always-night):** the product is a
> **night survey at golden hour**. It opens on a warm roasted-saffron sheet as its default
> landing state (light is the deliberate toggle), with saffron actions, contour/registration
> linework, and a forward-swept light that reads like dusk settling over a draft board. The
> earlier blue "blueprint", the pure espresso "night survey", and the light-parchment
> saffron pass were folded into this warm saffron-forward voice.

A full re-theme of the Architech UI. The warm *"heritage plaster"* identity (Kahn brick,
Louis Kahn / Adalaj modernism, arch frames) is gone. In its place: a **luminous golden-hour
atlas** of Indian places — warm, cartographic, and unmistakably "drawn," not painted.

> This is a theme swap, not a feature change. All token *slot* names (`--brick`, `--paper`,
> `--ink`, `--ember`, `--trust`, `--cream`, `--night`) are unchanged, so hundreds of call
> sites (`bg-brick`, `text-cream`, `text-ink`, `clay-fill`, `night-fill`, …) re-map
> automatically. Nothing was rewritten across the app; the identity was re-skinned where
> it actually lives.

## The concept

**A country drawn as a night survey at golden hour.** The default is the warm night — a
roasted saffron-brown sheet, not an espresso void. Saffron is the light source (the ember
against a marigold lamp); warm parchment linework does the drawing; emerald stays reserved
for *verification* — source, freshness, trust. The drafting idiom stayed, the palette got
saffron-forward, and night remained the default.

| Role | Old (heritage) | New (saffron-forward v4) |
| --- | --- | --- |
| Primary action | Terracotta brick `#a8432a` | **Deep saffron** `#c2410c` (light) / `#f79b2e` (dark) |
| Accent | Terracotta ember `#d07a4f` | **Ember / amber glow** `#d97706` (light) / `#ffbd66` (dark) |
| Trust (semantic) | Deep green `#2f6b5a` | **Verification emerald** `#217a50` (light) / `#7cc9a5` (dark) |
| Freshness / rating (gold) | — | **Golden trust** `#9c5b05` (light) / `#e8b13c` (dark) |
| Paper / canvas | Warm plaster `#f7f1e8` | **Warm parchment** `#f7efe0` (light) |
| Ink | Warm near-black `#241c18` | **Espresso ink** `#3a241a` (light) |
| Night / dark sections | Warm espresso `#221815` | **Roasted saffron sheet** `#2f180b` (dark) / `#1e0c05` (deepest) |

The **dark theme is the default and the product voice** — a warm roasted-saffron sheet with
warm parchment linework (`--ink` `#f6e6cf`), saffron actions (`--brick` `#f79b2e`),
and amber glow (`--ember` `#ffbd66`). Verified against the WCAG-AA 4.5:1 budget on every
solid surface; the repo's ratchets all pass (dark `--brick-deep` `#a94f07` on bone
`#fff5e6` = 5.11:1, parchment `#f6e6cf` on roasted saffron `#2f180b` = 13.94:1).

## Typography

| Use | Old | New |
| --- | --- | --- |
| Display | Fraunces (didone serif) | **Space Grotesk** |
| Body / UI | Archivo | **Instrument Sans** |
| Stamps / data | IBM Plex Mono | IBM Plex Mono (kept) |
| Devanagari | Noto Sans Devanagari | Noto Sans Devanagari (kept) |

The display swap from warm serif to a kinetic grotesque is the single loudest change: it
moves the voice from "heritage monograph" to "precision field equipment."

## Contour / registration linework

The drafting idiom is the survey's texture — the page reads as **a plotted sheet of land at
golden hour**:

- **Canvas:** the `body` carries a faint 32px drafting grid plus a soft **topographic
  contour field** on the warm night sheet, so empty space reads as land, not a flat fill.
- **Kicker rule (fixed):** the kicker is a short rule that *draws itself in*; the earlier
  floating crosshair "+" that read as a stray `------+` glyph was removed.
- **Dimension lead (retired):** `.field-rule` drew a dashed dimension line with a small
  solid lozenge at its head. The user flagged the rendered "-----.-" above the hero search
  as unwanted, so it is **no longer applied** to the hero or results composers (the CSS
  rule is retained but unused).
- **`.contour-field`:** a reusable concentric ring + grid field you drop on a section to
  give it a sense of place without a photograph (used on the city index).
- **`.survey-corner`:** a corner-rule quadrant with a soft floating origin dot, framing a
  stat/figure block (used on the evidence panel).
- **Image overlay:** the film grain became a fine **drafting grid + contour rings + whisper
  of noise**, so photography reads as a print on the survey sheet.
- **Atlas sheet:** labelled **`INDIA / NIGHT ATLAS · SHEET 01`**.

## Motion (golden-hour additions)

All opt-in (a `prefers-reduced-motion` user sees the static state), and snapped to the
existing `--dur-*` / easing system:

- **Rule draw:** the kicker rule animates `scaleX` from 0 — the moment the land is surveyed.
- **Survey drift:** the hero figure slow zooms-and-settles, feeling surveyed from a drone.
- **Contour reveal:** the display accent's em word underlines itself in after the line
   settles, like a highlighted contour line picking out the place.
- **Origin float:** the `.survey-corner` dot gently floats, so the registration mark is
  alive without shouting.
- **Ember bloom (new):** a soft saffron/amber radial glow *breathes* behind the hero and the
  closing CTA, so the page feels lit from a warm source rather than merely darkened.
  (`mix-blend-mode: screen`, blurred, `no-preference` only.)
- **Glow sweep (new):** a slow diagonal amber light washes across the hero figure on a
  11s loop — the sun clearing a ridge. Disabled under reduce along with the bloom.

## UI/UX design system (interaction brief)

The saffron voice is carried by concrete interface behaviour, not just tokens:

- **Hero search — transparent dark-glass pill + segmented control.** The search shell is a
  **translucent dark-glass pill** (`.search-glass`, `color-mix(night 54%, transparent)` +
  `backdrop-filter: blur(18px) saturate(150%)`) with **cream text** — true glassmorphism:
  the golden-hour hero shows through the blur, while cream-on-dark stays legible in BOTH
  themes (the hero is always the dark night panel). The prior `bg-paper/10` tint went light
  over the sky and washed the cream labels out (the "invisible in white theme" bug) and the
  interim `cream 88%` pill was too opaque — this frosted dark glass keeps both the
  *transparency* and the *readability*. It has a **spring scale-in** (0.95 → 1.0). Above it, a
  matching `glass-tabs` pill of **Buy / Rent / New projects** — the active tab is a
  **glowing deep-saffron pill** (`.seg-active` + saffron halo) with cream text, keeping AA
  contrast in both themes (the dark `--brick` is a light saffron that would leave cream text
  at ~3:1). "New projects" is an availability scope (`filters=availability-new`), not a fake
  intent, so the market model is untouched.
- **Property cards — soft geometry + solid saffron CTA.** Card radius bumped to `1.5rem`;
  the primary "View" CTA is a **solid saffron pill** (`clay-fill bg-brick` + cream text,
  `btn-sweep` hover); the map-pin accent is warm ember; the freshness stamp is **golden**.
- **Trust signals — golden, not red.** Freshness ("Updated today" / real-time) and rating
  tags use a dedicated gold token (`--gold`), which reads as credibility rather than alarm.
  RERA/verification stays emerald (`--trust`).
- **Card hover — warm amber diffused shadow.** `.card-warm-hover` lifts the card with a
  warm amber glow shadow instead of a cool grey one, and the thumbnail scales 1.0 → 1.05
  inside its masked frame.
- **Map pin pulse.** The live/selected map pin pulses with a saffron radial glow
  (`pin-pulse`), and hovering a list card lights the matching marker.

## Motifs re-sketched

- **Image frame:** the Kahn arch (`arch-frame`) is a **survey-window** — a chamfered sheet
  corner, like a plot pinned to a drawing board (`clip-path`, still clips the grid/zoom).
- **Logo mark:** the doorway-arch monogram became a **triangulated "A"** — the plumb line
  and the notch read as an architect's transit sighting, in saffron on deep night.
- **Maps:** OSM and the atlas surface get a warm, desaturated sepia-tinted filter.
- **Evidence stamps:** the mono labels re-voiced — `SURVEY DESK`, `ATLAS / TRUST`,
  `LOCATION / GRID 01`.

## Files touched

- `client/src/theme.css` — the core: tokens (incl. `--gold`), warm saffron-night dark theme
  + deep-saffron light action, typography, contour/registration linework, motion primitives
  (ember-bloom, glow-sweep, golden-hour-in, search-spring-in, segment-glow, pin-pulse,
  card-warm-hover), stamps, tints.
- `client/src/contexts/ThemeContext.tsx` — made the product **night-first** (dark is the
  default landing state; a stored light choice still wins; system light no longer triggers
  day mode on a fresh visit).
- `client/src/pages/Home.tsx` — hero: warm dusk scrim + saffron bloom + light sweep +
  golden-hour figure in + search spring-in; segmented Buy / Rent / New projects pill with
  glowing active tab; wired `.contour-field` (city index) and `.survey-corner` (evidence).
  **Hero search simplified & readable:** the hero carried four stacked control rows
  (intent segment + six category pills + search box + quick chips) that crowded and
  visually overlapped the search composer. The six category pills — whose `residential`
  entry rendered `t.hero.buy` ("BUY"), duplicating the active intent tab — were removed
  from the hero (category discovery lives in the Market Directory and search filters).
  The hero is now one clean segmented Buy / Rent / New projects row + the search bar +
  quiet quick-start chips. The composer is a **translucent dark-glass pill** (`.search-glass`,
  `color-mix(night 54%, transparent)` + blur) with **cream text** — transparent glassmorphism
  that stays readable in both themes; `.field-rule` was dropped here (and on the results
  heading), and the primary Search CTA got the `.btn-primary` full-pill + warm-glow
  treatment. Hero labels sit at 12px with `cream/75`–`cream/85` for legibility
  (no `!text-[<10]px`).
  **Hero background is the golden-hour glow, not the architecture photo:** a user asked why
  the hero seemed to show *two* backgrounds. There is only one asset — the load sequence
  faded the architecture photo in over the warm ember-bloom + scrim, so you saw a pure warm
  glow for a beat, then the brick photo. The fix makes the warm glow the actual background:
  a new `hero-glow` asset (soft amber saffron haze, sun bloom, no architecture) replaces
  `hero-ahmedabad` in the hero `<Pic>`, so the hero is a single cohesive golden-hour light.
  1584×672, registered in `IMAGE_INTRINSIC_SIZES`, with `.jpg` / `.webp` / `-800.webp`
  derivatives. `hero-ahmedabad` is retained for `og:image` / `twitter:image` (the social
  preview still uses the strong architecture shot).
- `client/src/lib/media/intrinsic-sizes.ts` — registered `hero-glow` (1584×672).
- `client/src/components/architech/PropertyCard.tsx` — soft `1.5rem` geometry, solid saffron
  CTA pill (+cream text), warm ember map pin, golden freshness stamp, `.card-warm-hover`.
- `client/src/components/architech/MarketDirectory.tsx` — readability pass: developer-index
  detail and project-rail stamps raised from 9–10px to 12px.
- `client/src/lib/i18n.ts` — added `hero.newProjects` (en + hi).
- `app/layout.tsx` — Space Grotesk + Instrument Sans fonts, `theme-color #180b05`.
- `client/src/components/architech/Footer.tsx` — brand line → saffron-survey voice.
- `app/global-error.tsx`, `public/favicon.svg`, `public/manifest.webmanifest`,
  `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png`.
- `client/src/lib/ui/design-token-discipline.test.ts` — updated ink-ramp + "small mono
  labels" fixtures to the live warm saffron tokens (`#2f160b`/`#e0c298`/`#c9a87a`).

## Guardrails kept green

- `pnpm check` (tsc) — clean
- `pnpm lint` (app + client/src) — clean
- `client/src` vitest suite — 930 passed
- `lib/ui` ratchets (design-token, surface-contrast, field-focus) — 159 passed
