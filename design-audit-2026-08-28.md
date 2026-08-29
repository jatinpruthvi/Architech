# ARCHITECH — Design System Audit + Theme Concepts + Dual-Audience Patterns

**Date:** 2026-08-28 · **Auditor role:** Senior UI/UX + design-systems review
**What was reviewed:** not screenshots — the actual runtime. `client/src/theme.css` (474 lines), the rendered DOM of `/`, `/search/`, `/broker/agent/leads` from a live dev server, `PropertyCard`, `Header`, `ResultsPage`, `ListingPage`, `AgentWorkspace`, `RequirementCapture`, `ListingGallery`, `Pic`, `filters.ts`, `ThemeContext`.

---

## 0. Verdict in one paragraph

You do not have a "generic" problem. You have an **over-enthused authorship** problem. "Amdavad Modern" is a real, defensible point of view — Kahn brick, plaster, arch frames, mono evidence stamps, a trust-green semantic reserved for verification only. That is more identity than 95% of real-estate portals will ever have. But you applied a *consumer editorial* skin to a *B2B data tool*, and you built your entire hierarchy out of **opacity instead of tokens**, which means your light theme is failing WCAG in 284 places, your dark theme passes, and the theme that "feels premium" is therefore also the one that's hardest to read. The 359 `!text-[Npx] !important` overrides are the tell: your type scale isn't a scale, it's a negotiation per call site.

Three sentences of brutal honesty:
1. The single most-used surface in your broker product renders its KPI numbers at **72px in a decorative serif** while its labels sit at **9–10px mono** — inverted priority for a professional tool.
2. **There is no visible entry point to the broker desk from global navigation.** 5 hardcoded `href="/broker…"` links exist, all of them *already inside* broker flows. 14 broker sections are unreachable from the front door.
3. **4 distinct photographs are served across 24 property cards.** Your "emotional connection" pillar is currently 16+14+12+6 image requests over 4 files. The theme is doing all the emotional work; the imagery is doing none.

---

## 1. Pillar-by-pillar audit with evidence

### Pillar 1 — Visual theme & branding

| Finding | Evidence | Severity |
|---|---|---|
| **Hierarchy is opacity, not tokens.** `text-ink/60` ×170, `/55` ×68, `/65` ×58, `/45` ×23, `/40` ×14, `/35` ×4, `/25` ×3. 477 opacity-derived text tokens total. | `grep -o 'text-ink/[0-9]*'` | **Critical** |
| Measured contrast of that hierarchy on `--card` (#fffaf2): `ink/25` **2.16:1**, `/40` 2.46, `/45` **2.81**, `/50` 3.23, `/55` 3.74, `/60` **4.36** — fails AA at 4.5. Only `/65` (5.12) and above pass. | computed from the actual tokens | **Critical** |
| The same scale **passes** in dark mode (`ink/45` → 3.73 on the dark card, `ink/60` → 5.44). So your "fine-print" tier is fine-print in light and near-invisible-by-accident in dark. Inverted legibility between themes is exactly what users perceive as "cheap". | computed | **Critical** |
| **`--muted-foreground` in dark mode is `#94a3b8` — slate blue**, a leftover shadcn default that is not in your warm palette at all. It's the token you *have* for secondary text, and it reads as a cool grey on brown. | `theme.css:113` | High |
| You *have* the right tokens and don't use them. `/search` rendered: `text-muted-foreground` **0 uses**, `text-ink/NN` **250 uses**. Same on `/`: 4 vs 168. | parsed SSR DOM | High |
| 359 `!text-[Npx]` `!important` overrides (191×10px, 80×11px, **56×9px**, 32×12px) — self-documented as a workaround for unlayered `.stamp`/`.kicker`. One missed `!` silently renders 11px. | `grep -o '!text-\[[0-9]*px\]'` | High |
| **27% of everything on the search results page is 9–11px mono uppercase**: 349 `.stamp` instances across 1,307 classed nodes. Editorial "data-ness" turned into a micro-capex tax on every screen. | parsed SSR DOM | High |
| 671 arbitrary-value utilities (`text-[…]`, `bg-[…]`, `gap-[…]`) vs 121 scale steps (`text-xs`×96 + `text-sm`×6 + 3 clamps) on `/search`. There is no spacing or type scale in practice. | `grep -oE` | Medium |
| Hardcoded `#b8472e` for checkbox `accent-color` in `RequirementCapture.tsx:140,148` while every other control uses `accent-[var(--brick)]`. Two "bricks" in one codebase. | source | Medium |
| 4 border alpha tiers in 285 uses (`ink/12`×122, `/15`×80, `/20`×47, `/10`×36) — arbitrary hairline soup. | `grep -o 'border-ink/[0-9]*'` | Medium |
| Fonts load from Google Fonts CSS in `app/layout.tsx:69` — render-blocking `<link>`, variable Fraunces (300–600 + italic) + Archivo (4 weights) + Plex Mono (2). `next/font` is unused, so no self-hosting, no subsetting, no `font-display: swap` guarantee, and a third-party request on the critical path for an India-skewed audience on flaky 4G. | `layout.tsx` | Medium |
| Hero `themeColor` is `#1b1612` (`layout.tsx:32`) but `--night` is `#221815`. Mobile browser chrome won't match the top of the page. | source | Low |
| **Good:** `prefers-reduced-motion` block is comprehensive, `touch-44` exists, focus-visible is 3px and explicit, `::selection` is branded, the surface-contrast guard test exists. This is above-average engineering discipline. | `theme.css`, `lib/ui/surface-contrast.test.ts` | — |

**Bottom line on branding:** the palette and motifs are not the problem. **The absence of a tokenized type + text-contrast scale is.** Right now "premium" is delivered by serif + plaster + grain, and "detail" is delivered by text nobody can read. Fix the ladder and the same brand reads premium *and* expensive.

### Pillar 2 — Dual-audience navigation

| Finding | Evidence | Severity |
|---|---|---|
| Global nav is `/buy/`, `/search/`, `/guide/`, `/list-property/`, and **`More` → `/sitemap.html/`**. A sitemap is an SEO artifact, not a nav item. 5 slots, one wasted. | `Header.tsx:23-29` | **Critical** |
| **No broker path in Header or Footer.** `href="/broker…"` appears 5× in the codebase, all inside broker pages already. A professional broker landing on the homepage has one adjacent signal: `/list-property/` (a *seller* page). | `grep` + `Footer.tsx` scan | **Critical** |
| No sign-in entry point anywhere in global chrome; `app/api/auth/session` exists, the UI surface doesn't. | source | High |
| The desk has **14 sections** (`inquiry, subscriptions, leads, my-listings, newspaper, agent-listings, owner-listings, ai, auctions, tenders, shortlisted, contacted, requirements, profile`) and its nav is one long flat strip — zero grouping into job-to-be-done clusters. | `app/broker/agent/[section]/page.tsx` | High |
| Desk sidebar has **no `aria-current`**, and its active state is `bg-brick text-cream` with **no `clay-fill`** — the exact bug class your own `theme-contrast-findings.md` documents. | `AgentWorkspace.tsx:128` | High |
| On mobile the 14-item sidebar becomes a horizontally-scrolling row of 10px chips with no scroll affordance, no snap, and no overflow menu. | `AgentWorkspace.tsx:128` | Medium |
| The consumer site and the desk share **one theme toggle** (`ThemeContext`, `localStorage` key `architech.theme`, applied to `<html>`). A broker who prefers dark for the desk gets the marketing site dark too; the desk cannot have its own default. | `ThemeContext.tsx` | Medium |
| **Good:** scroll-aware transparent-over-hero header, focus management on the mobile menu with Escape + first-link focus, Hindi/English toggle present, saved-count badge. | `Header.tsx` | — |

**Bottom line:** you don't have a dual-audience navigation. You have a consumer navigation with a secret door.

### Pillar 3 — Information architecture & search UX

| Finding | Evidence | Severity |
|---|---|---|
| **Filters can contradict each other and yield zero results.** All chips are AND: selecting `2bhk` *and* `3bhk+` is unsatisfiable. No group semantics, no mutual exclusion, no disabled-with-count="0" states. | `lib/filters.ts:15-26` + `applyFilters` | **Critical** |
| Only **10 filters**, and they're a mix of tiers: 2 BHK, 1 hardcoded price threshold (`Under ₹1.5 Cr`), a trust badge, 3 property types, 3 availability codes. **No locality filter, no real price range, no bathrooms, no area, no furnishing, no age, no amenities** — even though `details.bathrooms/parkingSpaces/furnishing` exist and are *rendered on the card*. | `filters.ts` | High |
| Your query parser already understands `2 bhk thaltej`, pin codes, and `under 1.5 cr` (`matchesQuery`) — but the **UI cannot express a price range at all**. The engine is more capable than the interface. | `filters.ts:62-95` | High |
| No facet counts anywhere. Users get "0 homes" as a *punishment* rather than a preview. | `FilterChips` | High |
| **Contradiction:** `FilterChips` active state is `bg-brick text-cream` with no `clay-fill` (`ResultsPage.tsx:51`) — the documented dark-mode 3.31:1 failure is live in the primary filter control. | source | High |
| The desktop "map" is a **360px sticky rail** in `lg:grid-cols-[1fr_360px]` — at 1024px that's ~33% of the content column for a map; at 1320px it's ~28%. And `mapMode` (the "show map instead" toggle) is `lg:hidden`, so **desktop users can't go map-full-bleed**; they only get "more map" = grid hidden, rail unchanged (same 360px). The toggle is a no-op on desktop except as a hide-list button. | `ResultsPage.tsx:316,363,435,448` | High |
| **Animation re-triggers on every filter change.** `key={`${active.join()}-${sort}-${id}`}` + `delay={i*60}` → 24 cards, up to **1.38s of stagger**; card 1 is blank for 60ms, and results *below the fold* animate while already off-screen. Perceived latency, not real latency. | `ResultsPage.tsx:369-371` | Medium |
| Vanity "signal" panel in the results header: `<dt>Map state</dt><dd>ON / LIVE</dd>` — a status readout for a boolean toggle, styled as a KPI. | `ResultsPage.tsx:353-354` | Medium |
| **Good:** filters + sort + query are URL-synced (back button + shareable), `aria-live="polite" role="status"` result count, `aria-busy` grid, skeletons, empty state has recovery chips derived from real inventory, honest "demo fixtures" disclosure in trust green, mobile drawer with explicit "show N homes" CTA. This is better than most production portals. | `ResultsPage.tsx` | — |

### Pillar 4 — Component design

| Finding | Evidence | Severity |
|---|---|---|
| **Card image box is `aspect-[1.25]`** = 80% tall. For a product whose pitch is emotional photography, the photo is the *shortest* dimension of the card. A 4:3 or 3:2 would be standard; 1.25 is landscape-crop-of-a-landscape. | `PropertyCard.tsx:139` | **Critical** |
| Card body is `p-5 md:p-6` with **7 border rules** — including a 3-column spec grid with `divide-x` **inside** a `border-y`, creating 3 nested boxed rows. The most rule-dense component in the system. | `PropertyCard.tsx:158-186` | High |
| Card contains **16 text nodes, 9 of them at 9–10px**, incl. a 9px `text-ink/45` (2.81:1) "Baths/Parking/Furnishing" labels and a decorative `AHM / 01 · FIELD NOTE` line that is pure chrome. | `PropertyCard.tsx:159-183` | High |
| **Compare button is `opacity-0 group-hover:opacity-100` and `hidden md:grid`.** On touch (your largest real-estate audience by volume) the compare control does not exist. Hiding a conversion action behind `:hover` is a desktop-only assumption. | `PropertyCard.tsx:166` | High |
| Only **4 images serve all 24 result cards** (16/14/12/6 requests). `secondaryImage()` correctly refuses to fake a hover photo — honest, but it means the flagship "cross-fade to a second real photo" moment is present on a minority of cards. | parsed SSR DOM, `PropertyCard.tsx:132-137` | **Critical (content)** |
| Lead form: consent is a **`defaultChecked` `required` checkbox** (`RequirementCapture.tsx:148`) — pre-ticked consent is a DPDP Act / GDPR problem, not just a UX one. | source | **Critical (legal)** |
| Lead phone validation accepts any 8 digits (`[0-9+ -]{8,}`, `length < 8`) — "12345678" passes; a 10-digit Indian mobile with a letter typo fails to be distinguishable. | `RequirementCapture.tsx:68`, `ListingPage.tsx:72` | Medium |
| Form labels are `stamp !text-[10px] text-ink/60` (2.81:1 at /45, 4.36:1 at /60 — borderline at the *only* size used), placeholders are `text-ink/35` (2.16:1, effectively invisible). | `RequirementCapture.tsx:146-147` | High |
| `bg-sand px-2 py-1 !text-[9px]` status chips (listing drafts, my-listings) rely on inherited text color — fragile by the exact mechanism you already fixed twice. | `AgentWorkspace.tsx:136,157` | Medium |
| **Good:** price-first hierarchy in the horizontal variant; real second-photo logic; `aria-pressed` on save/compare; save state is shared/persistent; skeleton is shape-matched; lightbox is keyboard-driven with arrow keys + Escape; gallery uses native scroll-snap instead of a carousel dependency; touch-44 is applied deliberately. | `PropertyCard`, `ListingGallery` | — |

### Bonus finding — first-paint theme flash
`ThemeContext` initializes to `"light"` on both server and first client render, then a `useLayoutEffect` swaps in the stored/system value. The CSS comment claims this is the "same flash-prevention as the old pre-paint inline `<script>`". It isn't: the server HTML is painted light before any effect runs, so a `prefers-color-scheme: dark` user still gets a light frame. Fix: blocking inline script or a `next-themes`-style sync script in `<head>` (already a dependency, unused for this).

---

## 2. Prioritised fix list (severity × effort)

| # | Fix | Severity | Effort | Payoff |
|---|---|---|---|---|
| 1 | **Replace all 477 `text-*/NN` with 4 semantic text tokens**, then re-measure contrast in both themes. Delete the opacity ladder. | Critical | M (codemod + 1 test) | Accessibility, theming, perceived quality |
| 2 | **Ship a real type scale**, remove 359 `!text-[Npx]`: `.stamp` = 12px/0.06em, `.kicker` = 11px/0.18em, no 9px anywhere. Fix layer order instead of using `!important`. | Critical | M | Legibility + maintenance |
| 3 | **Broker entry point in global nav** (`For brokers` + Sign in), grouped desk IA (3 clusters), `aria-current` on desk nav. | Critical | S | Turns a hidden product into a product |
| 4 | **Filter groups with facet counts + non-contradictory semantics** (OR within a group, AND across). Add price range + locality. | Critical | M | Zero-result dead-ends |
| 5 | **Card: swap aspect to 3:2, cut rules 7→2, remove 9px tier, make Compare always-visible on touch.** | High | S | Density *and* beauty together |
| 6 | **Fix the pre-ticked consent checkbox + 8-digit phone rule.** | Critical-legal | S | Compliance |
| 7 | `clay-fill` on `bg-brick` filter chips + desk nav active state (add to the guard test so it stays fixed). | High | S | 3.31 → 5.04:1 |
| 8 | Recolor dark `--muted-foreground` to a warm ramp (`#b9a99d`); delete `#b8472e`; self-host fonts via `next/font` with `font-variation-settings` + `tnum`. | High | M | Theme coherence |
| 9 | Stop re-animating results on filter change (key on `property.id` only; stagger max 4 items, ≤40ms). | Medium | S | Perceived speed |
| 10 | Make the map a first-class desktop mode (split 60/40, toggle to full-bleed); delete the "Map state: ON" vanity block. | Medium | M | Real map-list UX |

---

## 3. Three theme concepts (Figma-ready)

**The one architectural rule that makes all three cheap:** keep `theme.css`'s existing shape — *role* tokens (`--surface`, `--ink-1…3`, `--accent`, `--state-*`) that resolve to *palette* tokens — and add a **third axis: `data-surface="consumer" | "desk"`**. In Figma, build Variables with three modes: `Light`, `Dark`, and a `Surface` collection (`Consumer`, `Desk`). Then one component set serves both audiences and neither audience gets a compromised skin. Every theme below is specified in exactly that token structure, so all three are **skins over the same component library — build the components once.**

Common to all three (do not re-litigate per theme):
```
Text ladder (both themes, AA-minimum): --ink-1 primary (≥7:1) · --ink-2 secondary (≥5.5:1)
  · --ink-3 tertiary (≥4.5:1) · --ink-4 disabled (≥3:1, non-informational only)
Type scale (px/line-height): 12 · 14 · 16 · 20 · 26 · 34 · 46 · 64  — display sizes use clamp()
  floor = scale value, ceiling = 1.4× the next step up. No 9px. No !text-[Npx].
Numerals: font-variant-numeric: tabular-nums on every price, ₹/sqft, KPI and table cell.
Radii: 3 tokens — --r-sm 6 · --r-md 12 · --r-lg 20. One card radius, one control radius.
Focus: 2px --focus ring, offset 2px, always on the *control*, never on an inner input.
```

---

### Concept A — "Warm Editorial, hardened" (evolve what you have; lowest risk)

**Positioning:** keep the Amdavad Modern soul — it's your differentiator — but convert it from *costume* to *system*. Trust here comes from precision (aligned numerals, one hairline, measured spacing), not from texture.

**Palette**

| Token | Light | Dark | Note |
|---|---|---|---|
| `--canvas` | `#F6F1E9` | `#1E1714` | was `--paper`; drop the yellow ~4% to kill "café" read |
| `--surface` | `#FFFDF9` | `#2A201B` | cards |
| `--surface-2` | `#EFE7DB` | `#342721` | raised/zebra |
| `--ink-1` | `#1C1613` | `#F6ECE2` | |
| `--ink-2` | `#51453D` | `#C9B8AB` | ≥5.5:1 — this replaces `ink/60` |
| `--ink-3` | `#6E6058` | `#AC9C90` | ≥4.5:1 — this replaces `ink/45/50/55` |
| `--accent` | `#9E3E26` | `#E27A55` | clay; **never** used as surface+cream-label without the deep variant |
| `--accent-surface` | `#9E3E26` | `#8E3922` | the `.clay-fill` token, formalised |
| `--accent-soft` | `#F1DED4` | `#3A231C` | selected chip fill — **replace `bg-brick` for selected chips** so state is legible without a colour-contrast gamble |
| `--verify` | `#2C6A58` | `#7FB69F` | trust green, verification only (keep the discipline — it currently holds: 0 misuses found) |
| `--price` | `#1C1613` | `#F6ECE2` | prices are ink, not accent. Price ≠ marketing |
| `--rule` | `#E0D5C7` | `#3D2E27` | one hairline. No `ink/12`, `/15`, `/20` |
| `--focus` | `#9E3E26` | `#E27A55` | |

**Type:** Display `Fraunces` (opsz 9–144, wght 400–600, `SOFT 0`, `WONK 0`) for h1–h3 + prices; Text `Archivo` 400/500/600 for body/UI; `IBM Plex Mono` 400/500 for stamps, table data, filter chips. **Devanagari:** keep `Noto Sans Devanagari` for HI, and *add `Noto Serif Devanagari` as the display fallback* — Fraunces has no Devanagari, so Hindi headlines currently fall back to Georgia/system, which is where "premium" evaporates for half your copy.

**Layout — Home Search (`/search`)**
- `1280–1440px`: `280px filters | fluid results | 38% map`, map is a *mode*, toggle switches `results 1fr | map 1fr` → `map 1fr` with the result list as a 320px overlay drawer.
- Filter rail: 3 collapsible groups (Place · Type · Money), each with `(n)` counts; "Applied" chip row lives above results, not in the rail; **price is a dual-thumb range over a bar histogram of real inventory** (bars in `--surface-2`, selected in `--accent-soft`).
- Results: **2-up cards on desktop** (not 3-up) so the photo can breathe; list view = the `horizontal` variant promoted to default for desk density.
- Header band on results page: result count + `Save search` + sort. **Delete the 3-tile "signal" dl** (`Filter layers`, `Map state`).
- Whitespace: 24px card gap, 32px section rhythm, 40px before the first card row. One hairline per card, max.

**Layout — Property Details**
- Gallery first, full-bleed to the content column, 16:10 hero + 5-up thumbs strip; counter + `⤢ fullscreen` in the corner, no overlay on the photo itself.
- Below: `1fr | 400px` grid. Left = *dossier*: price block (Fraunces 46 with tabular figures) → 4-up spec strip (mono, no boxes, no dividers) → description → locality intel → verified-source panel with the RERA stamp expanded, not tooltip-hidden.
- Right = **one** sticky action card (`top: 88px`): price + ₹/sqft, EMI row, `Arrange a visit` (primary, `--accent-surface`), `Message broker` (secondary outline), `Download brochure` (tertiary text link). Under it: broker identity block with the verification trail. No second bordered box inside it.

**Keep:** arch frame (details hero only, *not* cards), grain at 0.5 → **0.25** opacity (0.5 on cards is how you get muddy photo edges), `--verify` discipline, `link-rail`.
**Kill:** `.index-num` on KPIs, `Nº 01` badges on cards, `FIELD NOTE` stamp, vertical `::after` dossier stamps inside desk panels (they fight the data), `border-beam` (never on a listing), `shimmer-btn` (not on any primary submit — keep on at most one marketing CTA).
**Figma:** one `Card/Property` set with `Density=[Editorial|Ledger]` variant; `Stamp/*` becomes `Label/Caps` at 12px.

---

### Concept B — "Quiet Concrete" (mini-minimalist; maximum perceived polish per hour)

**Positioning:** architecture-portfolio calm. Near-monochrome, generous whitespace, one clay accent used *only* for actions and selection. The safest theme for "modern + trustworthy" and the fastest to maintain, because it removes decisions rather than adding motifs.

**Palette**

| Token | Light | Dark |
|---|---|---|
| `--canvas` | `#FBFAF8` | `#141514` |
| `--surface` | `#FFFFFF` | `#1C1D1C` |
| `--surface-2` | `#F4F3F0` | `#242624` |
| `--ink-1` | `#141614` | `#F2F2EF` |
| `--ink-2` | `#4C514E` | `#BDBFBB` |
| `--ink-3` | `#71766F` | `#969A94` |
| `--accent` | `#B5452B` (clay, actions only) | `#E1795B` |
| `--select` | `#141614` fill / `#FFFFFF` label (selection = ink, not colour) |
| `--verify` | `#1F6B4F` | `#6FBF95` |
| `--rule` | `#E7E5E0` | `#2E312E` |

**Type:** `Neue Haas Grotesk Text` → free equivalent **`Inter Display`/`Instrument Sans`** for display *and* text (single family, weight + size does the work), + **`Berkeley Mono`/`JetBrains Mono`** for every number, price, and table cell. Display uses `wght 500`, `tracking -0.02em`, **no serif at all** — that's the "quiet" part. One rule: mono never renders a sentence, only a value.

**Layout — Home Search**
- **Zero visible chrome above results.** A single 56px pill search bar, centered, `max-width 720px`, with an inline segmented control (`Buy | Rent | Commercial`) and a `Filters` button that opens a **640px right-side sheet**, 2 columns, groups stacked, footer with `Show 24 homes`.
- Results = **list rows, 1 per line, 160px thumbnail**, because rows + whitespace is the densest-yet-calmest pattern for real estate. Photo is 3:2. Price right-aligned in mono at 20px. All secondary data in a single `·`-separated line at 14px `--ink-2` — no boxes, no grid, no rules.
- Map: appears only via toggle; 100% width with the list as a bottom sheet at 40% height (Google Maps / Zillow pattern), markers = price pills in `--ink-1`, selected = `--accent`.
- Scroll reveals **disabled** on results (see A/9); hero only.

**Layout — Property Details**
- 12-col grid, content in cols 3–10. Gallery is a full-bleed 16:9 band, then a **single-line headline block**: title · locality · price, 40px display, nothing else.
- Specs in a **2-line mono ledger** under a hairline: `3 BHK · 1,850 sqft · 3 baths · 2 parking · Semi-furnished · Ready to move`. One line, not 6 boxes.
- Sticky right rail `280px`: bordered *nothing* — the rail is just 2 buttons and a hairline. Trust content is an expandable row (`Verified source — 3 documents`) rather than a decorative panel.

**Kill for this theme:** grain, arch frames, stamps as decoration, all `::after` pseudo-text, marquee, tilt, index numerals, `page-transition`.
**Figma:** `Row/Property` (list) + `Card/Property` (grid) share one `Property/Data` component; `Sheet/Filters` is the only overlay. Variables: `Canvas/Surface/Ink/Rule/Accent/Verify` — 6 collections, 2 modes. Fastest theme to finish.
**Trade-off you must accept:** this theme is *less memorable*. It will look like a very good, slightly anonymous product. If brand distinctiveness is a KPI, choose A.

---

### Concept C — "Atlas Desk" (high-tech professional; the dual-audience answer)

**Positioning:** a **two-mode single system**. Consumer mode is warm, image-led, calm; desk mode is a cool, dense, keyboard-first operations terminal. The theme concept *is* the audience split — one token engine, two resolutions of it, switched by `data-surface` + an optional `data-density` on the same root. This is what Linear/Vercel/Stripe do for marketing-vs-product, and it's the only one of the three that structurally solves your brief instead of visually.

**Palette** (consumer mode ≈ A-lite; desk mode is the new part)

| Token | Consumer light | Desk light | Desk dark (default for desk) |
|---|---|---|---|
| `--canvas` | `#F7F3EC` | `#F1F2F4` | `#0E1116` |
| `--surface` | `#FFFDF9` | `#FFFFFF` | `#151A21` |
| `--surface-2` | `#EFE6D9` | `#E8EAEE` | `#1B212A` |
| `--ink-1/2/3` | `#1C1613` / `#51453D` / `#6E6058` | `#0F1419` / `#414A55` / `#5B6470` | `#E9EDF3` / `#A8B3C1` / `#8A97A6` |
| `--accent` | `#9E3E26` (clay = emotion, brand) | `#2C5CE0`? **no** — keep clay, but desk accent is **`#0B6E5A` teal** for operational affordances | `#3ECFA6` |
| `--data` | — | `#3B4A5A` (mono data ink) | `#9FB4CB` |
| `--verify` | `#2C6A58` | `#0E9F6E` | `#3ECFA6` |
| `--warn` / `--danger` | `#B4741A` / `#C0392B` | `#C98A16` / `#E5484D` | `#E7B24B` / `#F2555A` |

> **Design decision worth arguing about:** do *not* let desk and consumer share an accent. Same accent = same product = same expectations. Clay for the buyer's heart, a cool operational teal for the broker's job, and `--verify` green stays a single semantic across both (it is your brand promise).

**Type:** `Geist` (or `Instrument Sans`) for UI at 13/14/16 — desk UI is 13px minimum, not 12; `IBM Plex Mono` or `JetBrains Mono` `tnum` for every number, ID, timestamp and table cell at 12–13px; **`Fraunces` retained only for the two places the brand must speak**: the consumer home hero and the property title on the details page. Desk uses **zero display face** — a broker reading a leads table does not want typography with opinions.
**Data-grid typography spec (new, needed everywhere):** row height 40px (comfort 48), column alignment: text left, numbers right, status centred; sticky header `h-9` with `--surface-2` + `backdrop-blur`; zebra off by default, `data-density="compact"` on; sort carets 10px; active row `inset 2px 0 0 var(--accent)` on the left edge (no `border`-based selection — selection must not shift layout).

**Layout — Home Search (consumer mode)**
- Same as A (photo-forward, 2-up, 3:2, right rail filters) with the hero search kept as the only branded moment.
- **Add `⌘K`-style universal search** to the desk only, and expose it as a subtle `Search or jump to…` in the desk top bar — it's the highest-leverage B2B pattern and you already have `/api/search/suggest`.

**Layout — Home Search (desk mode: "listings ledger")**
- `Top bar 56px (org switcher, ⌘K, status) | left rail 240px (3 groups, counts as suffix badges) | content`.
- Default view is a **table, not cards**: `Photo 64px | Title + locality | Price (mono, right) | ₹/sqft | BHK/Area | Status chip | Views/Leads (sparkline cell) | Owner | Actions ⋯`, 40px rows, inline edit for price/status, bulk-select column, saved-view selector ("Needs price cut", "No media", "Leads > 5").
- Filters live in a **single toolbar row of popover selects with count badges** (Notion/Airtable pattern) — no persistent rail, because the data table needs the width. `+ Filter` opens a typeahead list of all fields grouped by category.
- Right side: **`Details` inspector drawer at 480px** opening over the table (row click) — photo strip on top, dossier below, actions pinned. Same drawer serves media moderation for admin.
- Density control (`Compact | Comfort | Editorial`) is a first-class desk control; **`Editorial` is literally Concept A's card grid** so a broker can see what the buyer sees. This one component is the entire dual-audience bridge — it makes the two audiences *interoperable* instead of merely coexisting.

**Layout — Property Details (desk/owner edit mode = "the dossier")**
- Replace the current full-page wizard chrome (`listing-dossier-body::before` vertical `ARCHITECH / MODERATION PACKET` stamp, `listing-packet` hard 12px offset shadow) with: **left `Form` column + right `Evidence` column (360px)**; the evidence column is a checklist (`Source ✓ · Rights ✓ · Locality ✓ · Price ✓ · Media 3/12`), each row clickable, with the moderation verdict as a `--verify`/`--warn` state chip. Same content, 40% less costume, and it's *actionable* rather than decorative.
- Sticky footer action bar (`64px`): `Save draft · Preview as buyer · Submit for review`. Progress is a thin `--accent` bar on the footer, **not** a numbered stepper with pseudo-element labels.

**Figma build order for C:** 1) Variables (3 collections: `Palette`, `Surface` [Consumer/Desk], `Mode` [Light/Dark]) 2) `Primitives`: `Button` (4 variants × 2 surfaces), `Label`, `Input`, `Chip`, `StatusChip`, `Table/Cell` 3) `Card/Property` + `Row/Listing` + `Inspector/Property` 4) `Sheet/Filters` + `Popover/FilterSelect` 5) pages. Do not design pages before step 2 — that's how you got 671 arbitrary values.

---

## 4. Pressure-test: the three friction points → 8 concrete patterns

### "Data vs Beauty" — the answer is **one card, two resolutions, plus an inspect layer**. Not two cards.

**Pattern 1 — Adaptive Media Header + Inspect Layer (the hero fix).**
Card = image only, 3:2, with a `--surface` price pill bottom-left and a save control top-right *on the image*. On hover/focus/long-press, a **data sheet slides up over the lower 30%** of the image with a 6-row mono spec table (`Price · ₹/sqft · BHK · Carpet · Bath · Parking · Status`) and the RERA stamp. Beauty at rest, data on intent. Because the sheet is the *same* component as the mobile "long-press" state, you ship one interaction, not two. *Effort: M. Directly replaces the current `aspect-[1.25]` + 7-rule card.*

**Pattern 2 — The Density control (system-wide, 3 states: `Photo | Balanced | Ledger`).**
`Balanced` = current card minus 9px. `Photo` = 16:9, title + price only, 1-up on desktop, infinite gallery scroll. `Ledger` = table rows (Pattern 6). **Persist to localStorage + URL (`?density=`), and default it by audience**: unauthenticated/mobile → `Photo`; `role=broker` or `/broker/**` → `Ledger`; consumer signed-in on desktop → `Balanced`. That one default is the single highest-leverage "knows my audience" detail in the product, and it's ~20 lines given you already have `SavedContext`/`LangContext` patterns to copy.

**Pattern 3 — Price as its own component (`Price/*`).**
Right-aligned, `tabular-nums`, always one size up from body, never in the accent colour, with `₹/sqft` and `Δ vs locality median` as sub-labels in `--ink-2`. Both audiences read prices first; only one reads them comparatively. `Price/Ledger` gets the `Δ` row, `Price/Editorial` doesn't. Kills the "serif display price" that currently makes buyers read a headline instead of a number.

### "Trusted onboarding" — **same primitives, different physics.**

**Pattern 4 — Split-door, one form.**
`/start` renders one 520px card: identity as **two wide, unequal tiles** — `I'm looking for a place` (60% width, photo, `Fraunces` label) and `I work with property` (40%, `--surface-2`, mono label, "RERA ID, lead inbox, payout" bullet row). Then **one** email/OTP flow for both; the difference is what you land on, not what you fill in. Anti-pattern to avoid: two funnels → you maintain two auth UIs and 2× the drop-off. Only real fork: brokers add `RERA ID` (you already validate Gujarat RERA) as step 2, buyers add a 3-question requirement (you already have `RequirementCapture`). **Ship `role` into `Providers` and make the theme `data-surface` derive from it — then "which theme am I in" is automatic, not a toggle the user has to reason about.**

**Pattern 5 — Desk chrome vs consumer chrome as tokens, not copies (this is what makes the theme system hold).**
Desk = **60% of the whitespace, 85% of the type size floor at 13px, zero display face, zero grain, zero arch, zero pseudo-stamps, one hairline, 40px rows, backdrop-blur headers, visible keyboard hints (`⌘K`, `J/K`, `Enter`).** Consumer = the opposite on every axis. Encode it as `--density-scale`, `--surface-radius`, `--rule-color`, `--type-min` on `[data-surface="desk"]`. Two rules that specifically fix your current broker screen: (a) **KPI numbers max 28px, labels minimum 12px, both in the same family** — `index-num text-7xl` is decorative on a dashboard; (b) **remove every `.desk-*::after`/`::before` caption** (`FIELD OFFICE / 2026`, `SOURCE GATE`, `AI / CONTRACT`) from inside data containers — a label that's unselectable, invisible to screen readers, and overlaps dense rows is costume in a workspace. Keep exactly one branded moment on the desk: the desk header.

**Pattern 6 — `Row/Listing` (broker table row) + `Inspector/Property`.**
Row: `photo 56px | title + locality (1 line) | price tnum | ₹/sqft | status chip | leads count | ⋯`. Inspector opens at 480px over the table with the buyer-facing card at the top ("what the public sees"), tabs below (`Media · Evidence · Leads · Notes`). One row, one click, everything a broker needs — and the buyer view of the same data answers "why is my listing not working" without leaving the desk.

### "Filter overload"

**Pattern 7 — Counted facet sheet with group semantics (fixes the zero-result dead-end).**
`Filters` button (badge = active count) opens a **right sheet, 720px, 2-pane**: left = group nav (`Place · Type · Price · Status · Trust`), right = the controls for that group, each option showing `n` matches and **greyed with `(0)` when it would return nothing in the current combination**. Within a group: OR (checkboxes). Across groups: AND. Same `n` shows on the applied chip row above results, and each chip has `×`. This is the single change that converts your filter system from "demo" to "product" — and `applyFilters`/`makeFilters` need a real refactor to support grouping, so budget for it.

**Pattern 8 — Parse-then-confirm query, and presets.**
(a) You already parse `2 bhk thaltej under 1.5 cr` in `matchesQuery`. Surface it: type anything → a row of **"We understood"** chips (`BHK 2` `Locality Thaltej` `≤ ₹1.5 Cr`) that *become* real filters with one click, plus `Show all 24` to opt out. Highest-trust pattern available for a dual audience: buyers get free text, brokers see and edit the structured result. (b) **Presets** (`First-time buyer`, `Investor: yield`, `Ready-to-move only`, `My saved search`) as chips above the sheet — this is how you carry 30 filters for power users while showing a newcomer 5, and you already have `saved-searches` routes to hang them on.
Supporting micro-patterns: **histogram price range** (replaces `Under ₹1.5 Cr`), **locality map-polygon picker** (you have `atlas-map` + maplibre — drag-select beats typing), **`⌘K` jump-to for the desk** (skip filters entirely for known-entity lookups), **filter drawer "Show N homes" as the primary footer** (you already do this on mobile — make desktop match).

---

## 5. Codemod sketch for fix #1 and #2 (so this doesn't stay advice)

```bash
# 1. Collapse the opacity ladder into tokens (verify each diff by eye, don't blind-apply).
rg -l --glob '*.tsx' 'text-(ink|cream|foreground)/(25|35|40|45|50|55|60)' | while read f; do
  sed -i -E 's/text-(ink|cream|foreground)\/(25|35|40)/\1-4/g;
             s/text-(ink|cream|foreground)\/(45|50|55)/\1-3/g;
             s/text-(ink|cream|foreground)\/(60|65)/\1-2/g;
             s/text-(ink|cream|foreground)\/(70|75|80|85)/\1-1/g' "$f"
done
# 2. Retire the !important size overrides: .stamp/.kicker take real values, then:
sed -i -E 's/ !text-\[(9|10|11)px\]//g' $(rg -l '!text-\[(9|10|11)px\]' --glob '*.tsx')
# 3. Add a guard next to lib/ui/surface-contrast.test.ts:
#    - fail on any text-*/NN opacity utility in tsx
#    - fail on any !text-[Npx]
#    - fail on any bg-brick without clay-fill (already exists — extend to chip/nav cases)
```
Then set `.stamp { font-size: 12px; letter-spacing: .06em }`, `.kicker { font-size: 11px }`, put both in `@layer components`, and delete the call-site `!`. Re-run `pnpm test && pnpm test:a11y` — the axe suite already exists, so the regression should be cheap to prove.

---

## 6. What I'd need from you to go further

1. **Screenshots/Figma frames of the current state** — specifically the search results page, one property details page, and the broker desk, at 1440px and 375px. The code tells me the tokens; the images tell me whether the *composition* is the failure or the palette is.
2. **Is the broker desk a paid product?** (Subscription tiers exist in the nav: `subscriptions`.) If brokers pay, the desk is the product and the consumer site is the acquisition surface — that inverts most of my prioritisation toward Patterns 4–6 and Concept C.
3. **Fixture vs production data.** `ARCHITECH_DATA_SOURCE=fixture`, 24 listings, 4 photos. Is the real inventory feed (AddressBox/Hozen per your docs) live? Pattern 1 and the whole "beauty" pillar are unshipable without ≥6 photos per listing — that's a data contract, not a design task.
4. **Are you starting from `shadcn` intent?** You have `components.json` + `radix` + `next-themes` but hand-rolled `.stamp/.kicker/.clay-fill` and a light/dark system that only half-wired the token layer. Adopting `next-themes` for real + `shadcn` tokens as the *role* layer would delete ~120 lines of `theme.css`.
5. **Hindi/Devanagari: how much traffic?** If >15%, the missing Devanagari display fallback is a P0 and Concept A changes.
6. **Is the consumer app mobile-first or desktop-first by session share?** `touch-44` and the `md:`-gated compare button suggest mobile matters; if >50% mobile, "Photo" density should be the default for everyone and the map should be a bottom sheet everywhere.
