# Design & interaction improvement plan

Audited 2026-08-28 against the working tree at `arena/01a047df-architech` (`a816bcb` +
the lint follow-ups). Every finding below is a file:line I read in this repo, not a
heuristic about "real-estate apps". Where I checked something and it was already fine,
that is recorded in §1 so nobody re-does it.

---

## 0. Verdict

The **static** design system is now in good shape: tokens, contrast in both themes,
type scale, the facet engine, and the reduced-motion contract are all pinned by tests.

The **interactive** layer is where the remaining distance lives, and it is not where
you would guess. The gap is not "add more animation" — you already have 13 keyframe
animations and a disciplined reduced-motion block. The gap is that **three input paths
work only with a mouse, one full-viewport unit does not exist on mobile, and the detail
page — the single most valuable screen — has no navigation at all.**

Ranked by harm-per-hour-of-work:

| # | Improvement | Severity | Effort |
|---|---|---|---|
| 1 | Suggestions list is mouse-only on `/search/`, and `role="listbox"` promises keyboard | P0 | S |
| 2 | My `FilterSurface` `<ul role="group">` erases the count; one `<li>` is not in a list | P0 | XS |
| 3 | `aria-expanded={focused && (queryLen > 0 \|\| true)}` — tautology, always `true` | P0 | XS |
| 4 | Detail page: no section nav, no anchors, "more homes" is a hand-rolled card | P1 | M |
| 5 | Zero `dvh`/`svh`/`env(safe-area-inset)` in a half-mobile product | P1 | S |
| 6 | Results reflow with no FLIP; every filter click teleports the grid | P1 | M |
| 7 | Images pop in — `Pic` has no load transition, no intrinsic size, no LCP priority | P1 | S |
| 8 | Two hand-rolled `role="dialog"`s with no focus trap | P2 | M |
| 9 | Map is synced one-way | P2 | S |
| 10 | `motion` is installed and imported by exactly 2 files (`PropertyCard`, `Home`) | P2 | — (keep) |

---

## 1. What is already right (do not "improve" these)

Evidence, so this list is not vibes:

- **Reduced motion is real, not decorative.** `theme.css:373-383` disables
  `mask-line`, `fade-rise`, `hero-zoom`, `page-transition`, `marquee-track`,
  `border-beam`, `shimmer-btn`, `skeleton`, and sets `scroll-behavior: auto` — plus a
  global `animation-duration: 0.01ms !important` floor. Three JS-driven components guard
  themselves with `matchMedia("(prefers-reduced-motion: reduce)")`
  (`NumberTicker:14`, `TiltCard:10`, `WordReveal:11`). This is better than most product
  teams manage; leave it alone.
- **Map→list sync is complete and thoughtful.** `MapListSync.tsx:95-97` selects *and*
  `scrollIntoView({block:"center", behavior:"smooth"})`, and there is a full
  list-only fallback (`mapFailed`) so a blocked tile server does not eat the results.
- **Header scroll-awareness is scoped correctly** (`Header.tsx:20` — the dark hero
  treatment applies only on `pathname === "/"`), so it does not break the other pages.
- **Route-level motion already exists**: `app/template.tsx` + `.page-transition`
  (560ms, `arch-page-in`). Most sites pay a framework plugin for this.
- **Selection semantics in the facet CSS are honest** — `(0)` results are
  `aria-disabled` + dashed and stay visible, and `:hover` explicitly backs off for them
  (`theme.css:482,488`).
- **Guard tests already pin the surface**: `surface-contrast.test.ts` (link/layer
  cascade + solid-fill label ownership) and `design-token-discipline.test.ts` (113 cases,
  ratcheted debt baseline, touch-target and no-hover-gating checks on the filter surface).

---

## 2. Interaction integrity — the P0 set (all cheap, all real)

### 2.1 The suggestions list on `/search/` cannot be used from a keyboard
`ResultsPage.tsx:353-364` renders `role="listbox"` with `qSuggestions.map(...)`, and
the only handler on each option is:

```
onMouseDown={(e) => { e.preventDefault(); runQuery(s.query); }}
```

Two defects in one line. `role="listbox"` is a *contract*: assistive tech switches to a
virtual cursor, reads the child `option`s, and expects **arrow keys to move and Enter to
choose**. This list answers none of that. A keyboard user tabbing the primary task of the
site opens a dropdown they cannot operate.

`Home.tsx:127-129` already implements this properly (`ArrowDown` →
`setHighlight(i => (i+1) % optionCount)`, with `aria-activedescendant` at `:229`). So the
fix is not invention — it is **sharing the hook's navigation state with the results page
and then deleting the duplicate logic from Home**. That is the point worth making:
the two pages each grew their own copy of the same control, and one copy is worse.

**Spec it as one component** (`SearchSuggest`), not two: combobox input + `role="listbox"`
+ ↑/↓/Home/End/Enter/Escape, `aria-activedescendant`, scroll the highlighted option into
view, and `role="option"` (not `<button>`) on children.

### 2.2 `role="group"` on a `<ul>` deletes the thing you most want read
`FilterSurface.tsx:128`:

```
<ul className="mt-3 space-y-2" role="group" aria-label={...}>
  {counted.options.length === 0 && <li className="facet-hint">{labels.localityNone}</li>}
```

Two problems:

1. `role="group"` **overrides the list role**, so NVDA/JAWS stop announcing
   *"list, 6 items"* — the count that tells a home seeker whether a locality is thin or
   rich. And `role="group"` does not name its children, so the `<li>` wrappers add
   nothing. Use `role="list"` + `role="listitem"` on the `<ul>`/`<li>` (the reset CSS
   already needs `list-style` restored in some browsers), or drop the `<ul>` entirely.
2. That `facet-hint` `<li>` is only rendered **when the map is empty**, so in the other
   case there are 6 `<li>`s and in this one a **stray `<li>` inside no list at all** — a
   validation error and a screen-reader artefact. Make it a sibling `<p>`, outside the list.

While in there: the selection state is `aria-pressed` on each button. That is *legal* but
semantically wrong for a filter — `aria-pressed` means "toggle this thing's own state",
which is why NVDA says "2 BHK, toggle button, not pressed" when the useful sentence is
"2 BHK, 14 results, selected". `role="checkbox"` + `aria-checked` + `aria-label`
containing the count is the honest model, and it costs nothing in the CSS because the
guard test already keys off `[aria-pressed="true"]` — **update
`design-token-discipline.test.ts:191-192` and `surface-contrast.test.ts` together with it,
or the two guards start fighting.**

### 2.3 A tautological `aria-expanded`
`Home.tsx:228`: `aria-expanded={focused && (queryLen > 0 || true)}` — the parenthetical
is `true` for every input value, so this collapses to `focused`, and it announces
"expanded" while `#search-suggestions` is conditionally absent from the DOM. It should be
`focused && suggestions.length > 0`. Same file, same line: `aria-controls` points at an
id that only exists when `focused`, so `aria-expanded=false` + `aria-controls`-to-nothing
is fine but the current pair is not.

This class of bug — a control that *looks* wired and is a no-op — is exactly what the
next §6 test is for.

---

## 3. The detail page has no navigation (`ListingPage.tsx`)

Measured: **1 `href="#..."` in the entire product** (the skip link), and **0
`scroll-margin`/`scroll-mt-*` declarations**. The page renders 6+ long sections
(price history `:239`, agent `:270`, cost, trust, "more homes" `:345`) inside one
~3000px scroll with no orientation, no way to jump, and no way to know how deep you are.

Three changes, in order of value:

**3.1 Sticky section rail + scrollspy.** Desktop: a 200px left rail inside the content
column listing `Photos · Price · Locality · Agent · Trust · Nearby`, each an anchor, the
active one marked by a 2px clay rule + `--ink` (not a filled pill — this is an editorial
system, the marker should read as a margin note). Mobile: the same list becomes a
horizontally scrollable row **pinned to the top of the StickyBar**, and it doubles as
progress because the active item is the second one from the left as you descend.
Implementation: one `IntersectionObserver` with `rootMargin: "-45% 0px -50% 0px"`
(centre band, so the rail does not flicker on fast scroll), no library, and it degrades to
plain anchors when JS is off because they're real `href`s.

**3.2 `scroll-margin-top` as a global rule.** The header is sticky at ~102px; the moment
any anchor exists it will land under it. Add to `theme.css`:
`[id] { scroll-margin-block-start: 120px; }` — do it **before** 3.1, not after, and pin it
in the guard test so the next anchor someone adds cannot regress it.

**3.3 Replace the hand-rolled card at `:346-353` with `PropertyCard`.** That block
re-implements the listing card with `aspect-[1.4]`, `text-ink/60` and `text-[12px]`
overrides — while `PropertyCard` is at `aspect-[1.5]` with `.ink-2`. So the "more homes"
row is measurably, visibly a different card from the one on search results, and it has to
be maintained twice. `PropertyCard` is used by 6 files; the detail page's own suggestions
should be the 7th. (Also fixes its contrast drift for free — the labels at
`:350-353` are still `text-ink/60`.)

**3.4 Price history is a dead SVG.** `:239` is the money conversation on the whole page
and nothing in the file animates or responds to a pointer. Minimum viable interactivity:
hover/tap → crosshair + a tooltip with `month, ₹/sqft, Δ vs previous`, and the
"1Y / 3Y / all" range toggle re-drawing with a 300ms path transition. Do it with `<path>`
+ `d` transition or `motion`'s `pathLength`, not a charting dependency.

---

## 4. Mobile realism: the viewport unit you are not using

`dvh`/`svh`/`lvh`/`env(safe-area-inset)` appear **0 times** in `client/src` and `app`.
What is used instead: `min-h-screen` (`app/compare/page.tsx:20`,
`ErrorBoundary.tsx:28`), `lg:max-h-[calc(100vh-130px)]` (my own
`ResultsPage.tsx:487`), `h-[62vh] ... lg:h-[calc(100vh-190px)]` (`:610`), and a
`100vh` block in `AgentWorkspace.tsx:128`.

On Chrome Android, `100vh` is the height of the viewport with the URL bar **hidden** — so
every full-height surface renders 15-20% too tall while the page first loads, and the
bottom of it is unreachable until the user scrolls enough for the bar to collapse. And
`StickyBar.tsx:25` is `fixed inset-x-0 bottom-0` with no `env(safe-area-inset-bottom)`,
so on a gesture-nav device the primary CTA sits under the home-indicator strip.

Prescription (mechanical, low risk, do it as its own commit):
- full-bleed/flex-height surfaces → `min-h-[100svh]`, `h-[100dvh]`
- fixed bottom bars and the sheet footer → `padding-bottom: max(12px, env(safe-area-inset-bottom))`
  (as a `.safe-bottom` utility in theme.css so it is used consistently, not inline)
- the sticky filter rail → `max-h-[calc(100dvh-130px)]`
- Add the same "no `100vh` where `dvh` is meant" check to the guard test — this class of
  bug is invisible in every desktop devtools you will use it in.

---

## 5. Motion: the two changes that pay, and the ones that don't

### 5.1 FLIP the results grid (highest perceived-performance change available)
Today a filter click re-renders the grid and every surviving card **teleports** to its new
slot. `ResultsPage.tsx:48` already keeps the skeleton geometry in sync with the card
(`aspect-[1.5]`), which was the right first step; the remaining 100% is position.

`motion@13.1.1` is already a dependency. `<LayoutGroup id={searchStr}>` + `layout` on the
card wrapper, 280ms spring (`{ stiffness: 420, damping: 34 }`), and `layout="position"`
only (so the image box does not distort while it moves). Respect the existing reduced-motion
contract by rendering the same tree without `layout` when the media query matches — the
JS-side guard pattern is already in `NumberTicker.tsx:14`, copy it.

This is why it belongs on the list and generic "add animation" does not: **a moving card
tells you your filter didn't reload the page, it re-arranged your inventory.** That is
feedback, not decoration, and on a lead-monetised product it is the difference between
"the search is fast" and "the search flashed".

### 5.2 Load transition for photography (`Pic.tsx`)
`Pic` has `loading=lazy`, `decoding=async`, `srcSet`, `sizes` — good — but: no `width`/
`height` unless `src` is passed explicitly (`Pic.tsx:34-35`), no `fetchpriority="high"`
path for first-view images (`eager` sets it, but the LCP candidate is picked per-page and
nothing opts in), and no fade on decode. Result on a mid-tier Android on 4G: a grid of flat
`bg-sand` rectangles that snap to photos.

The free version needs no new asset pipeline: keep the `bg-sand` box (it already prevents
CLS), add `onLoad={() => setDone(true)}` → `opacity: 0 → 1, 420ms ease-out`, and pass
`fetchpriority="high"` for index 0-3 of a results page. ~25 lines in one primitive,
applies to every image on the site.

### 5.3 Explicitly: do not add more
- Do not put `motion` everywhere. Only `PropertyCard.tsx` and `Home.tsx` import it; the
  CSS layer carries everything else — that is a feature (no animation cost in SSR, one
  source of truth). Keep the split as a **rule**, and write it down: *CSS keyframes for entrances/hover; `motion` only for
  layout FLIP, exits, and drag.*
- No parallax, no page morphs, no scroll-jacking. For a product whose differentiator is
  "trustworthy, evidence-stamped" this is the fastest way to look like a template.
- Do not animate the map's `easeTo` further — 450ms is already right, and `fitBounds`
  at 500ms on first paint is the polite end of the range.
- `NumberTicker` (`magicui/NumberTicker.tsx`) is fine; if you touch it, swap its rAF loop
  for `motion`'s `animate()` for a spring, and nothing else.

---

## 6. Feedback, focus, and the tests that keep them honest

### 6.1 The product has two kinds of dialog, and the worse one is on the money path
`ListingPage.tsx:57` runs its lead-capture form through the real Radix Dialog
(`Dialog`/`DialogContent`/`DialogHeader` — focus trap, restore, `inert`, and it is the
only Radix-dialog consumer in `client/src` + `app`). Two other surfaces re-implement the
same thing by hand:

- `RequirementCapture.tsx:103` — `<section role="dialog" aria-modal="true">`,
  `fixed inset-0`, an Escape listener at `:50`, no Radix import at all
- `ListingGallery.tsx:123` — `<div role="dialog" aria-modal="true">`, same shape

Neither moves focus in on open, restores it on close, or traps Tab, so Tab walks straight
out of the "modal" into the page behind it and `aria-modal` is asserting something the DOM
does not do. `RequirementCapture` is the **saved-search / zero-result capture surface** —
the exact revenue seam from the filter rebuild — so this is the worst place in the product
to have a leaky dialog.

Fix: move both onto `components/ui/dialog` (vaul's drawer is already Radix-backed, which is
why the mobile filter sheet gets the trap for free), which deletes hand-rolled Escape
handling in the process. Add the guard: *any `role="dialog"` must come from
`components/ui/dialog` or `components/ui/drawer`* — an import check, 6 lines.

Second half of the same bug: **the lightbox is a 12-photo carousel whose only key is
`Escape`.** Left/right through a gallery is not a nice-to-have on a site whose pitch is
photography.

### 6.2 Save has no acknowledgment and no undo
`SavedContext.tsx` persists to `localStorage` silently (the SSR-hydration comment at `:13`
is correct — don't "fix" the deferred load). But the heart at `PropertyCard.tsx:86,161`
fires with no toast and no undo, and `Toaster` is already mounted globally
(`Providers.tsx:11` import, `:22` render). One `toast("Saved · Paldi 3 BHK", { action: { label: "Undo" } })` turns
a mis-tap from a lost listing into nothing. The heart-pop is optional; the undo is not.

### 6.3 Guard tests to add (these are the cheapest "stay excellent" lever you have)
Extend `client/src/lib/ui/design-token-discipline.test.ts`, which already has the
mechanism, with:
1. **no hover-only affordance anywhere** — generalise the existing
   "never gates a control behind hover" check from `FilterSurface.tsx` to all of
   `client/src` (it catches the `opacity-0 group-hover:opacity-100` pattern that made
   Compare unusable on touch — already a real bug you shipped once).
2. **ARIA wiring smoke test** — every `role="combobox"` in the codebase must declare
   `aria-expanded` bound to a state variable whose expression is not a tautology
   (regex: no `|| true`, `&& true`, `!== undefined ||` inside an `aria-expanded`), and
   every `role="listbox"` file must contain a key handler. This is the test that would have
   caught §2.1 and §2.3 in the day they were written.
3. **no `<li>` outside a list, no `role` on `<ul>` that removes `list` semantics.**
4. **dialog contract**: any `role="dialog"` in `client/src` must come from
   `components/ui/dialog` or `components/ui/drawer` (import check), not hand-rolled.

---

## 7. Figma-ready specs for the four new patterns

### P-1 Section rail + scrollspy
- geometry: 200px column, `top: 120px`, `gap 14px`, item 44px min-height (touch),
  12px mono uppercase via `.stamp`
- states: default `--ink-3` · hover `--ink-2` · active `--ink` + 2px clay rule on the left,
  rule animates its `translateY` between items (240ms) rather than re-fading — motion
  carries the "you are here" meaning
- mobile: `overflow-x: auto`, `scroll-snap-type: x proximity`, hidden scrollbar, sticky
  under the header
- do not: fill the active item's background (that is the selection idiom you already use
  in filters; the rail is navigation, not state)

### P-2 FLIP results grid
- 280ms spring `{420, 34}`, `layout="position"`
- exit: `opacity 0, scale 0.985, 140ms` — leave the frame before neighbours slide in
- entering cards keep the existing capped stagger (`Math.min(i,3)*40`), so the first row
  resolves instantly and the 12th is not a slideshow
- reduced-motion: identical layout, no transitions (never a different DOM)

### P-3 `SearchSuggest` (single component for Home + Results)
- listbox `max-height: 320px`, own scroll, 8 items then scroll
- item: 44px, `role="option"`, `aria-selected` (not `aria-pressed`), highlight =
  `--sand` fill + 2px clay left rule — **same idiom as the facet option, on purpose**
- group headers (`Locality`, `Project`, `Pincode`, `Recent`) as `role="presentation"`,
  never focusable
- footer line: `↑↓ to move · Enter to search · Esc to close`, `.stamp` + `--ink-3`,
  `sm:` only (mobile users do not need a legend for keys they don't have)

### P-4 Image load + LCP
- placeholder: existing `bg-sand` (no blur-up asset pipeline — a 900ms→420ms crossfade on
  decode is 95% of the benefit at 5% of the cost)
- `fetchpriority="high"` + `loading="eager"` for results index 0-3, lazy for the rest
- `width`/`height` always emitted from `WIDTHS` (already known in `Pic.tsx:3-9`) so the
  reserved box is intrinsic, not just CSS

---

## 8. Suggested execution order

1. **PR A — integrity, half a day:** §2.1 + §2.2 + §2.3 + §6.3 tests 2 and 3. No visual
   change, and it removes every "looks wired, isn't" defect found in this audit. Do this
   first because §5.1 and §7's patterns build on the same components.
2. **PR B — mobile realism, half a day:** §4 + safe-area on `StickyBar`/sheet footer +
   guard test for `100vh`.
3. **PR C — the detail page, 1-2 days:** §3.3 first (delete the duplicate card — pure
   debt removal), then §3.2, then §3.1, then §3.4 as its own follow-up.
4. **PR D — motion, 1 day:** §5.2 then §5.1 (image fade first: it makes FLIP look better
   because the cards are not still decoding while they move).
5. **PR E — dialogs, 1 day:** §6.1 (Radix migration) + lightbox arrows + §6.2 undo toast.

Two things I deliberately did **not** propose: a design-token sweep of the remaining
418 alpha-text usages (already a ratcheted baseline; sweeping it is its own PR and the
build will not regress), and any new animation dependency.
