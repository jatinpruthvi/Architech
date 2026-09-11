# ARCHITECH — Filter Rebuild Spec (v1)

**Date:** 2026-08-28 · **Follows:** `design-audit-2026-08-28.md`
**Answers to:** free product monetising leads · live inventory with real photos · roughly even desktop/mobile split.

---

## 0. Two corrections to my own audit (I was wrong, and you were right)

**Correction 1 — Pattern 8 already exists.** I recommended "parse-then-confirm" as if you'd have to build it. You built it, and it's better than my suggestion: `client/src/lib/search/parse-query.ts` is a deterministic grammar (with Hindi vocabulary — `किराया`, `ख़रीद`) that turns `3 bhk in koramangala under 2 cr` into structured scope with an explicit `residual` so "understanding a query can never lose information". `ResultsPage.tsx:172-185` calls `parseSearchQuery` → `applyParsedQueryToParams`, and even renders a *pre-run* `describeParsedQuery` preview. **Scrap that pattern; the work is only to make the preview visually distinct** (it's currently a `text-ink/60` 11px string — your own audit finding #1). Don't rebuild what you have.

**Correction 2 — but the results page does not use your live data.** You said the inventory feed is live with real photos. Here's the actual chain:

```
ResultsPage.tsx:21   import { searchListings } from "@/lib/search/search"   ← client, fixture repo
ResultsPage.tsx:85   initialSearch = searchListings(...)                    ← filter #1 over getListings()
ResultsPage.tsx:100  fetch(`/api/search/?…`)
  → app/api/search/route.ts → searchListingsFromSearchParamsForServer
    → server.ts:25   listings = await getListingsForServer()               ← findMany({ where: { lifecycle: "ACTIVE" } })  ALL ROWS
    → server.ts:33   applySort(applyFilters(applyMarket(applyQuery(scoped…))))  ← filter #2 in JS, in the request
    → response       results: items        ← already filtered, fully serialised
ResultsPage.tsx:102  setSearchResponse(data)                                ← and the client re-filters? no — it renders. But the fixture copy still ran at :85
```

`getListingsForServer()` (`client/src/lib/repositories/server/prisma.ts:45-53`) has **no `where` beyond `lifecycle`**, no `take`, no pagination — and `listingInclude` pulls `city`, `locality`, and `media` for every row. So with 40k live listings: one unbounded `findMany`, ~40k serialised objects, FTS/trigram never executed. And `buildPostgresSearchPlan` (`sql.ts:20`) builds a correct `where` array — including trigram + `websearch_to_tsquery` — that is **attached to the response as `queryPlan` and read by nothing** (`grep queryPlan client/src --include=*.tsx` → 0 hits). You wrote a Postgres search compiler and then didn't run it.

Plus a re-render bug: the effect's dep array includes `initialSearch`, a `useMemo` that returns a **new object identity whenever any dep changes**, and `setLoading(true)` runs on mount → **every visit to `/search/` flashes skeletons over already-correct server-rendered results**, then adds up to **1.38s** of stagger (`delay={i*60}`, key includes `active`+`sort`). Your filter feels 300% slower than the data is.

**The rebuild is therefore 60% plumbing, 40% UI.** Fix the plumbing first or the beautiful facets will just render counts slowly.

---

## 1. Why "free product, paid by leads" makes the filter a conversion surface

Not just a navigation aid. Three consequences that change design decisions:

1. **A zero-result state is lost revenue, not an empty page.** Every dead-end is a lead you didn't capture. So the design rule is *never return an empty screen* — there's an escalation ladder (§7) and each rung is a capture opportunity.
2. **Counts are your primary trust signal.** A free aggregator's advantage over broker-run portals is neutrality: "24 verified in Thaltej · 3 new this week" is a claim no individual broker's site makes. Ship counts before you ship more filters.
3. **Saved search is the lead pipeline**, and you already have `/api/saved-searches` + `requirement` capture. The filter panel should feed both, and the *no-results* state should feed the requirement form.

Because the desk is not a paid product, don't build Concept C's density control yet. **But still build the facet engine audience-neutral** (below) — it's ~free now and it's the thing that makes the desk ledger cheap later.

---

## 2. Facet model (replaces the flat 10-chip list)

Replace `makeFilters()`'s flat array with groups. **Within a group: OR. Across groups: AND.** That single rule kills your current class of bug where `2bhk` + `3bhk` is unsatisfiable (`filters.ts:16-17` are both AND-predicates today).

| Group id | Label | Type | Values | Predicate on `Listing` | Card? |
|---|---|---|---|---|---|
| `place` | Locality | multi + search | registry slugs | `localityId IN (…)` | consumer only |
| `price` | Budget | range (₹) | `min`/`max` in paisa-free ₹ | `priceInr BETWEEN` | both |
| `bhk` | Bedrooms | multi | 1,2,3,4,5+ | `bhk = n`, `bhk >= 5` | consumer |
| `type` | Property type | multi | apartment, villa, rowhouse, plot, office, shop, pg | `propertyType IN (…)` | both |
| `status` | Status | multi | ready, new launch, resale, under construction | `availability IN (…)` | both |
| `area` | Carpet area | range (sqft) | min/max | `areaSqft BETWEEN` | desk |
| `trust` | Verified | single toggle | RERA verified | `verification = 'RERA_VERIFIED'` | both |
| `size` | Baths / parking | multi | 2+, 3+ / 1+, 2+ | **no column — JSON-scraped from `sourceSummary`** — see §4a | blocked |
| `media` | Has photos / 3D tour | multi | ≥5 photos, video | `EXISTS (…media…)` | both |
| `fresh` | Listed within | single | 24h, 7d, 30d | `meaningfulUpdatedAt > now()-n` | both |

Notes on judgement, not taste:
- **Move `Under ₹1.5 Cr` out of the filter vocabulary permanently.** A hardcoded budget is a demo artifact; the range control subsumes it, and `parse-query.ts` already emits `maxPriceInr` so the two halves meet for free.
- **Keep `trust` as a toggle, not a chip.** It is your brand promise; a boolean deserves its own affordance with the count of *what's excluded* ("12 listings pending verification — hidden"). That sentence is worth more trust than any badge.
- **`media` is a real filter you don't have** and you have `PropertyMedia` + `derivatives` to power it. For a photo-led audience, "hide listings with no photos" is the single most-used utility filter on mature portals.
- Cap *visible* consumer groups at 5 (`place`, `price`, `bhk`, `type`, `status`) + `trust` + `fresh`. The rest exist in the model, render in the desk, and stay hidden from buyers. This is how you carry 30 facets without showing them: **one engine, per-audience projection.**

### Schema (audience-neutral core)

```ts
// client/src/lib/search/facets.ts
export type FacetValue = { id: string; label: string; labelHi?: string;
  /** SQL predicate fragment, parameterised — never interpolated from user input. */
  predicate: SqlFragment; };
export type FacetGroup = {
  id: string; label: string; labelHi?: string;
  kind: "multi" | "single" | "range" | "histogram";
  values?: FacetValue[];
  range?: { field: string; min: number; max: number; step: number; unit: string; buckets?: number };
  projection: Array<"consumer" | "desk">;      // ← the dual-audience switch
  defaultOpen?: boolean;
};
export type FacetState = Record<string, string[] | { min: number; max: number } | boolean>;
export function whereFrom(state: FacetState, groups: FacetGroup[]): { sql: string; params: unknown[] }   // AND across groups, OR within
export function countsFor(state: FacetState, groups: FacetGroup[]): Promise<CountMap>                      // §5
```

`applyFilters`/`parseFilterParam`/`serializeFilters` keep working against the old ids (see §8) so nothing mid-flight breaks.

---

## 3. The surface: one component, three projections

Because your split is **even**, the drawer must not be a mobile fallback — it's the same component at a different size. One `FilterSurface` with a `placement` prop:

| Viewport | Placement | Geometry |
|---|---|---|
| ≥1440 | left rail | 288px, sticky `top:88px`, `max-h: calc(100vh - 120px)`, own scroll |
| 1024–1439 | overlay sheet from left | 352px, `backdrop-blur`, scrim `--ink/40` — **rail width would squeeze the map, so it becomes an overlay, not a smaller rail** |
| 768–1023 | bottom sheet | 720px wide centred, `max-h: 76vh`, groups stacked |
| <768 | full-height bottom sheet | snap `40% / 88%`, drag handle 32×4px |

**Rules that make it feel premium (each one is a bug in your current build if skipped):**
1. **Applied count lives on the trigger** (`Filters · 3`), and the trigger is `clay-fill`-less *until* selected — selected chips use `--accent-soft` fill + `--ink-1` label, **not** `bg-brick text-cream`. Your audit finding: `ResultsPage.tsx:51` has the 3.31:1 bug live on the most-clicked control on the page.
2. **Footer is sticky and shows the outcome, not a label:** `Show 24 homes` (primary) · `Clear all` (tertiary text). You already do this on mobile (`ResultsPage.tsx:312`) — promote it, don't invent it. **The CTA count must be a live preview, so counts must come from the same `where` builder the results use** (single source of truth or the number lies).
3. **Zero-count options are `disabled` + visible, never removed.** Removing options teaches people the filter is broken; disabling with `(0)` teaches them the inventory is real. Grey `aria-disabled`, `--ink-3`, `(0)` in `--ink-3`, tooltip-free.
4. **Range controls on touch:** thumb hit area 44×44 (`touch-44` exists), track 4px, active fill `--accent-soft`, dual-thumb min gap = 1 bucket, keyboard = arrows 1 step / shift-arrow 10, `role="slider"` with `aria-valuetext="₹85 lakh to ₹1.4 crore"`.
5. **Budget labels in Indian units only.** A histogram over ₹ in `Cr`/`L` must format with `Intl.NumberFormat("en-IN", { notation: "compact" })` → `₹1.4 Cr`, never `₹14,000,000`, and never `1.4M`. Tooltips and slider values both.
6. **No animation re-trigger on apply.** Key the card list on `property.id` alone; stagger only the first 4 items at ≤40ms, and **only on first paint of that query**, not on filter change.

---

## 4. Data contract — the part that decides whether this ships

### 4a. Blocking gap (worse than "missing columns")
`Listing` has: `priceInr`, `bhk`, `areaSqft`, `availability`, `propertyType`, `verification`, `postalCode`, `latitude/longitude`, `meaningfulUpdatedAt`, `sourceSummary`, `media[]`.
It has **no `details` column** — `grep -n "details" prisma/schema.prisma` → 0 hits — yet `PropertyCard.tsx:173-175` renders *Baths · Parking · Furnishing* on every card.

Here's where that data actually comes from (`mappers.ts:179`):

```ts
details: row.details ?? parseDetails(row.sourceSummary),
// parseDetails(): JSON.parse(sourceSummary) — catch → return {}
```

**So `bathrooms`/`parking`/`furnishing` are JSON scraped out of a free-text source-summary string, and any parse failure silently yields `{}`.** Consequences, in order of how much they should worry you:
1. In production, whether a card shows "2 baths, 1 parking" or "Baths — Parking — Furnishing —" depends on whether a third-party feed happened to serialise JSON into a prose column. Silent, per-listing, and invisible to you.
2. A card that shows `—` to a home buyer reads as a broken product, not an honest one. You are shipping a 3-cell spec grid whose data is best-effort.
3. **You cannot index or filter on it.** A `bathrooms >= 2` facet over parsed-at-runtime JSON means scanning every row and re-parsing in JS. This is precisely why `size` is marked "desk only, blocked" in §2.
4. `sourceSummary` is also what you display to users as *provenance*. Using the same column as both a trust artifact and a data carrier means one field with two incompatible contracts.

Required before step 6 of §8: promote the fields that matter into typed columns (`bathrooms SmallInt`, `parkingSpaces SmallInt`, `furnishing FurnishingStatus`, `project Text`, `developer Text`) with the mapper populating them at ingest and a backfill for existing rows. Until that's done:
- **(a)** do the promotion now (plus a `details Jsonb` for display-only extras, GIN-indexed if you want to filter on those), so the spec grid becomes real and `size` becomes filterable; or
- **(b)** drop *Baths · Parking · Furnishing* from the card and keep `sourceSummary` as provenance only. **While the schema is untouched, (b) is the honest default** — a field that exists in the UI but not in the data is worse than a missing field, because it trains users to distrust every number you show them.

Whichever you pick, delete the `?? "—"` fallback from the card: a rendered em-dash is a UI bug wearing a design token.

### 4b. New response shape

```jsonc
// GET /api/search/?city=ahmedabad&f=place:thaltej&f=bhk:3&price=9000000-15000000&page=1
{
  "results": [ /* page of 24, mapped Property */ ],
  "page": { "total": 142, "pageSize": 24, "page": 1, "pages": 6 },
  "applied": [ { "group": "bhk", "id": "3", "label": "3 BHK" } ],
  "facets": {
    "place": [ { "id": "thaltej", "label": "Thaltej", "count": 48 }, { "id": "bopal", "label": "Bopal", "count": 0 } ],
    "bhk":   [ { "id": "2", "count": 31 }, { "id": "3", "count": 48 }, { "id": "5+", "count": 4 } ],
    "type":  [ … ], "status": [ … ], "trust": [ { "id": "rera", "count": 96 } ], "media": [ … ], "fresh": [ … ]
  },
  "histogram": { "field": "priceInr", "bucketWidth": 1000000,
                 "buckets": [ { "from": 8000000, "to": 9000000, "count": 6 }, … ],
                 "p5": 4200000, "p95": 21800000, "total": 142 },
  "residual": "near dps school",          // from parse-query, shown as free-text chip
  "source": "postgres-fts-trigram"
}
```

`facets[g]` counts are computed with **group `g`'s own predicate removed** and every other active predicate applied — that is what makes "(0)" meaningful and what stops users building impossible combinations.

### 4c. Query strategy (don't over-engineer)
- **v1 (ship this week):** scope to the city server-side (`where cityId = ? AND lifecycle='ACTIVE'`), fetch that set **once**, cache per `city|category|intent` with 60s TTL, compute all groups' counts in memory, then slice+sort for the page. ~1–3k rows/city is nothing; you keep the existing `applyFilters`/`applyQuery` code and delete the double-filter. This alone fixes the unbounded-query problem.
- **v2 (when a city exceeds ~10k rows):** execute `buildPostgresSearchPlan`'s `where` for real with a page query + `COUNT(*) OVER()`, and one grouped count query per dimension (`GROUP BY "Listing"."bhk"` etc., ~8 indexed queries). **You already wrote the compiler — wire `prisma.$queryRaw` to the plan you return and the dead code becomes the engine.**
- **Never** fetch unscoped. The `?city=` fallback to nationwide (`search.ts:63`) is nice for graceful degradation and terrible for query cost — bound it (`limit` + "showing top N of M across India" when scope is empty).
- Cache-Control on the endpoint is `no-store` (correct for results); counts can be a separate `no-cache, stale-while-revalidate=60`.

---

## 5. Server contract for counts (exact SQL, v2)

```sql
-- base: every predicate EXCEPT the group being counted. Per group:
SELECT bhk AS value, COUNT(*) AS n
FROM "Listing" l JOIN "Locality" lo ON lo.id = l."localityId"
WHERE l.lifecycle = 'ACTIVE' AND l."cityId" = $1
  AND l."priceInr" BETWEEN $2 AND $3
  AND lo.slug IN ('thaltej','bopal')          -- place applied
  -- AND l.bhk = …                             ← deliberately omitted for the bhk group
GROUP BY bhk;

-- histogram (p5/p95 first, then equal-width buckets — raw max would squash everything left)
WITH b AS (SELECT percentile_cont(0.05) WITHIN GROUP (ORDER BY priceInr) lo,
                  percentile_cont(0.95) WITHIN GROUP (ORDER BY priceInr) hi
           FROM "Listing" WHERE lifecycle='ACTIVE' AND "cityId"=$1)
SELECT floor((priceInr - b.lo) / ((${W}) ))  AS bucket, COUNT(*) FROM "Listing", b
WHERE lifecycle='ACTIVE' AND "cityId"=$1 GROUP BY 1 ORDER BY 1;
```
All values parameterised; group ids whitelist-resolved through `FacetGroup` so no user string reaches SQL (`predicate: SqlFragment`, §2).

---

## 6. URL contract

- Canonical: `?f=group:value&f=group:value` (repeatable), `?price=MIN-MAX`, `?area=MIN-MAX`, `?q=` only for `residual`, `?page`, `?sort`, `?city`, `?pincode`, `?category`, `?intent`.
- **Back-compat:** `parseFilterParam` must accept the legacy `?filters=2bhk,rera` form and map ids → groups (`2bhk`→`bhk:2`, `under15`→`price:-15000000`, `type-villa`→`type:villa`). Shareable links from before the rebuild must not 404 into an empty result. Redirect-on-read (302 to canonical) is nicer than silent accept — it also upgrades everyone's saved links.
- Every control writes through the existing `updateUrl` so back/forward and share stay correct — keep this, it's the best thing in the current page.
- **Deep-linkable preset:** `?preset=first-time-buyer` expands server-side into the facet state, so a preset is *editable*, not opaque.

---

## 7. Zero-result ladder (the revenue-relevant screen)

You already have recovery chips derived from real inventory (`ResultsPage.tsx:188`) — good. Formalise it as a ladder so the page never bottoms out, and put the copy in the type ladder (§audit fix #1: this is the most emotionally important sentence on the site, so it must be readable):

1. `We found nothing for those 3 filters — here are the 4 closest.` (relax the **single** constraint with the highest count-loss, computed from the count map; label it: *Removing "5+ BHK" finds 12 homes* with one-tap apply.)
2. Widening affordance: `Try Bopal (18 nearby)` — adjacent localities from `localities` registry + `PINCODE_PROVENANCE` you already have.
3. **Capture, don't apologise:** `Tell us what you're looking for — brokers get matched to it.` → pre-fills `RequirementCapture` with the *exact* facet state, not blank. This is the monetisation seam: your filters feed the requirement record. One field pre-filled correctly is worth ten form fields removed.
4. `Save this search and we'll message you the day something lands.` → `POST /api/saved-searches`, phone number as the only required field. **This is the highest-intent lead you will ever collect and it is currently not offered on the empty state.**

---

## 8. Implementation sequence (each step independently shippable, ~ordered by payoff/risk)

> **Status after the 2026-08-28 session (measured, not asserted).** `npx vitest run`
> **553 passed / 553**, `npx tsc --noEmit` clean, `npx eslint` clean on the changed files.
>
> | # | Step | State | Evidence |
> |---|------|-------|----------|
> | 1 | Delete the skeleton flash | **done** | `consumedRef` in `ResultsPage.tsx`; `initialSearch` moved out of the effect deps via `fallbackRef` (not a lint suppression) |
> | 2 | Facet groups + OR/AND | **done** | `lib/search/facets.ts` + `facets.test.ts` (26 tests, incl. `bhk:2,3,4` → 4 rows where the old code returned 0) |
> | 3 | City-scoped fetch | **done (v1)** | `server.ts` pushes city scope into the read; `MAX_UNSCOPED_LISTING_ROWS = 5000` + `truncated` flag. `total`/paging still open — see note below |
> | 4 | `facets` in response + `FilterSurface` | **done** | SSR check: 17 `facet-group`, 91 `facet-option`, disabled `(0)` rows render as `aria-disabled` not hidden; `text-ink/45` count in the new files: 0 |
> | 5 | Histogram + dual range | **done** | 10 bars, 3 flagged `data-inrange`, axis `₹60 L → ₹4.6 Cr` (p5→p95 of scoped inventory). Fields are 2 inputs, not thumbs — deliberate, see §3 |
> | 6 | `media` filter | **done** | `has-photos` / `photos-5plus` over `gallery.length`; defaults OFF because §4a is unresolved |
> | 7 | Ladder + saved-search CTA | **done** | Zero-result SSR shows relax → widen → trending → capture; `q=paldi&intent=rent` → "0 homes to rent" + honest empty locality group |
> | 8 | `$queryRaw` plan | **not started** | correct call: no city exceeds ~10k rows yet; `truncated` is the tripwire |
> | 9 | Guard test | **done** | `client/src/lib/ui/design-token-discipline.test.ts` (113 cases) + `design-token-baseline.json` ratchet + `design-token-baseline.cjs --write` |
>
> Two deviations from this spec, both intentional:
>
> 1. **9px is ratcheted, not deleted repo-wide.** A hard `expect(0)` would have made my
>    first guard test a lie — 40 usages across 17 files remain (`LocalityIntel`,
>    `ListingPage`, `Home`, `AgentWorkspace`…), and sweeping them is its own PR. The test
>    now fails on any NEW 9px and on any file exceeding its recorded budget, so the number
>    only moves down. The three files this rebuild owns are pinned at true zero.
> 2. **`--brick` needed a second token, not a tweak.** `--brick` is 5.77:1 in light but the
>    dark theme re-points it to `#d36a48` = **4.16:1** on `--card` — fine for a 26px display
>    price, short for a 12px mono action. So small clay actions use `--facet-link`
>    (`color-mix(--brick 82%, #fff)`, 5.31:1 dark), while display numerals keep `--brick`.
>    Found by measuring, not by reading; do not "simplify" it back to one token.

1. **Delete the flash** (30 lines): drop `initialSearch` from the effect deps, guard the effect with `if (searchStr === lastConsumedRef.current) return`, and don't `setLoading(true)` when the server response equals the initial render. Removes the skeleton flash + the 1.38s restagger. **Do this before anything else; it changes how "fast" the whole theme feels.**
2. **Facet groups + OR/AND semantics** in `facets.ts` with `applyFilters` rewritten over groups; keep legacy ids mapped. Add the 5 missing groups. Unit-test the contradiction case (`bhk:2` + `bhk:3` → union of both; `bhk:5+` + `type:plot` → empty *and both counts show why*).
3. **City-scoped single fetch + in-memory counts** (§4c v1) in `server.ts`; remove the unbounded `findMany`; drop the double-filter; `results` becomes a page, `total` comes from the filtered count.
4. **`facets` + `histogram` in the response** and the `FilterSurface` component (rail/sheet by breakpoint, per §3 geometry) with counts, `(0)` disabled, sticky outcome footer, tokens from theme concept A (`--accent-soft` for selection, `--rule` hairlines, `--ink-2/3` labels — **no `text-ink/45`, no 9px, no `!text-[Npx]`, no `bg-brick` chip without `clay-fill`**).
5. **Price histogram + dual range** (44px thumbs, en-IN compact labels), `area` range for desk projection.
6. **`media` filter + "hide listings with no photos"** (default on for consumer *only if* §4a resolves to real coverage; else default off and show the count).
7. **Presets + `?preset=` + zero-result ladder + saved-search CTA** on the empty state.
8. **`$queryRaw`-executed plan** (§5) when a city exceeds ~10k rows.
9. **Guard test** alongside `lib/ui/surface-contrast.test.ts`: fail the build on (a) `text-*/NN` opacity utilities, (b) `!text-[Npx]`, (c) `bg-brick` without `clay-fill`, (d) any `facetGroup` value lacking a `predicate`, (e) `/api/search` returning `results.length !== page.total` on page 1.

---

## 9. Acceptance criteria

- Every visible option shows a count; every count equals what clicking it yields. (A single lying number destroys the trust claim worse than no number.)
- No combination of consumer-visible filters renders an empty screen without the §7 ladder.
- Contrast of filter UI text ≥4.5:1 in **both** themes at the sizes used; checked, not asserted.
- `?filters=2bhk,rera` from an old shared link still returns the same 24 results as before.
- `/search/` first paint shows results (no skeletons) on a warm visit; TTFB of `/api/search` for a mid-size city < 250ms at p75; zero unbounded `findMany` in the request path.
- Keyboard: `Tab` reaches every option, `Esc` closes the sheet with focus returned to the trigger, slider arrows work, `Show 24 homes` is the last tab stop.
- Mobile and desktop are both first-class: same component, same counts, same footer CTA, no `hidden lg:block` feature asymmetry (the current map toggle has exactly that bug: `ResultsPage.tsx:316` is `lg:hidden`, so desktop can't go full-bleed map).
