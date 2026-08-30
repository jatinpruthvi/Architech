# StudyArena round 12 — contestant E: implementation record

**Source:** `docs/seo/10 studyarena-round12-contestant-e.md`
**Branch:** `arena/01a04d70-architech`
**Scope:** E proposes a "programmatic local SEO machine" across six sections
plus a 90-day plan. This pass audits each against the code, implements what
is real, and records where a recommendation was deliberately not taken.

---

## E's thesis

> You will not outrank housing.com on "flats in Mumbai". Stop playing their
> game and win 10,000 small battles they're weak at.

Concretely: generate long-tail locality pages from structured data (§1), put
the number in the title (§2), mark everything up (§3), work Google-only
surfaces (§4), earn links with a published price index (§5), hold the
technical line (§6).

---

## Section by section

### §1 The page machine — mostly built; the new pages would be thin

E asks for five page types with launch/Year-1 targets.

| E's page type | Target | State |
| --- | --- | --- |
| Locality pages | 500 → 3,000 | **Built.** 72 live at `/buy/{city}/{locality}/`, each with median, ₹/sq ft, PIN, trend, and a real amenity distance table. |
| Project pages | 200 → 2,000 | **No `Project` model.** Deferred since file 8. |
| "Near" pages (`schools near X`) | 100 → 1,000 | **Data exists, pages deliberately not built.** See below. |
| Price-trend pages | 100 → 1,000 | **Published this pass** as the per-city index (§5). Per-locality rows are a table on it, not pages. |
| Builder pages | 50 → 500 | `/developers/` index exists; no per-builder data to build 500 pages from. |

**On "near" pages.** `locality-intel.ts` already carries `CommuteStop[]` —
place, distance, category — and it renders on the locality page. Splitting
"schools near Paldi" into its own URL would produce a page whose entire
content is a slice of a page that already ranks, which is the doorway pattern
E warns about in §7 and exactly what his own §6 ("delete thin content, under
~300 words") says to remove. The distance table stays where it is.

**On scale.** 500 → 3,000 pages is a function of data, not templates. The
evidence gate from file 7 (`EVIDENCE_BAR.programmatic`) holds every generated
page to `activeListings >= 6 || verifiedTransactions >= 1 || uniqueWordCount >= 300`.
Raising the count without raising the inventory would publish pages the gate
exists to stop.

**On URL structure.** E proposes `/locality/mumbai/andheri-west`,
`/project/...`, `/near/...`, `/price-trends/...`. The live structure is
`/buy/{city}/{locality}/` — already clean, already indexed, and carrying the
buy intent in the path. Renaming 72 indexed URLs to match a template would
spend real equity on cosmetics. The one new surface this pass adds follows
the existing convention (`/price-index/{city}/`).

### §2 Title tags — implemented, and it exposed a defect

E's template is `Flats in {Locality}, {City} — 1/2/3 BHK Price ₹{X}/sqft`. It
does not survive the budget: it runs past 60 characters for most Indian place
names. His *reason* does, so the reason was implemented rather than the string.

Doing that exposed a bug in the ladder it replaced. `localitySerpTitle` passed
three tails of decreasing length to `composeSerpText`, which appends parts in
order and **breaks at the first that does not fit**. The longest was tried,
overflowed, and the loop ended before the two shorter ones were ever
considered — they were unreachable.

*Measured on the built corpus: **15 of 72 locality pages** shipped a bare
"Koramangala, Bengaluru" title with up to 26 characters of budget unused.*

`fitTail(subject, candidates)` now tries candidates richest-first and returns
the first that fits, so the ladder degrades instead of giving up. The
candidates are real facts where the sample supports them:

1. `— 2/3/4 BHK, ₹11,842/sq ft`  (configurations actually available)
2. `— ₹11,842/sq ft`
3. `— homes & locality context`
4. `— homes for sale`
5. `— homes`

*Measured after: **0 bare titles**, **66 of 72** carry price or configuration
data (was 0), **0 truncated**. The 6 that fall back to text are Ahmedabad
localities whose sample is below the publication bar — the gate working, not
a gap.*

### §3 Schema — one part applied, two withheld

- **`RealEstateListing`** — already on listing pages. No change.
- **`BreadcrumbList`** — now on the 13 new price-index routes (449 → all
  content routes that have a hierarchy).
- **`FAQPage`** — **not applied.** The decision register withholds it: Google
  restricted FAQ rich results to authoritative government and health sites in
  2023. E's goal is "People also ask" and featured snippets; FAQ markup is no
  longer the mechanism, and the pages answer questions in visible prose
  regardless.
- **`AggregateRating`** — correctly absent, and E agrees it should be: "fake
  ones risk a manual penalty". There are no real reviews yet.
- **`Dataset`** — considered for the price index and **not used**. Google's
  Dataset rich results target Dataset Search, a separate vertical for research
  and government data; marking a property-price table as a `Dataset`
  overstates it. The index is marked up as `Article` with `about` the city.

### §4 Google-only moves — one rejected on the evidence

- **Google Business Profile, YouTube walkthroughs, citations, Search Console
  batch indexing** — operational, nothing to build, nothing in the repo
  contradicts them.
- **Split sitemaps** — already done; now **7** segments with the addition of
  `reports`.
- **Google Maps embed on every locality page** — **not applied.** E's stated
  reason is that it "signals relevance"; Google has never confirmed that
  embedding Maps affects ranking. The cost is concrete: the Maps JS API is
  hundreds of kilobytes on 72 pages, which would work directly against the
  LCP target E sets in §6. The locality page already publishes verified
  coordinates and a real distance table to amenities, which is the substance
  the map would have carried. The repo has MapLibre for the one place an
  interactive map genuinely belongs — the search results surface.

### §5 Authority — the substantive gap, now closed

E calls a published price index "the only thing you can't fake" and "how you
build domain authority in months, not years".

**The report already existed.** File 7 built `market-trends.ts` — per-city and
per-locality, transaction-aware, with a minimum-sample gate and an explicit
coverage statement. Its own record called it "the linkable asset".

**It was not reachable.** The only consumer was
`app/api/cities/[slug]/market-trends/route.ts` — a JSON endpoint. Nobody cites
a JSON endpoint; no searcher finds one. The asset earned nothing.

This pass publishes it:

- `/price-index/` — hub, all 12 cities including the ones it cannot publish.
- `/price-index/{city}/` — median, ₹/sq ft, median rent, per-locality table
  with each locality's delta against its own city average, coverage counts,
  methodology, limitations.
- `Article` + `BreadcrumbList` JSON-LD, with the sample size and the minimum
  sample attached as `additionalProperty` — because an index that does not say
  what it measured is not citable, which is the entire point.
- Added to the SEO page registry and to a new `reports` sitemap segment.

**The gate travels with the page.** Indexability is the report's own
`publishable` flag, not a second opinion. Ahmedabad clears the minimum at
city level (4 sale listings against a bar of 3) but **0 of 6 localities** do,
so it prints no figures and is `noindex, follow`. It is excluded from the
sitemap while still showing the blocker. *Withholding the number and
withholding the page are the same decision, made in one place.*

*Measured: 13 routes built, 12 in the `reports` sitemap, 1 (Ahmedabad)
noindexed and excluded, 0 unsegmented pages.*

### §6 Technical — one rule implemented, one target declined

- **Internal linking, hub-and-spoke** ("every page links to its parent + 5
  sibling pages") — **measured and fixed.** Locality pages linked **4** sibling
  localities; 5 are available (6 per city minus itself). Now 5 on all 72.
  The related-listings grid on a listing page stays at 3: it is a
  `sm:grid-cols-3` layout, and 5 cards would orphan a row.
- **Delete thin content (< ~300 words)** — already enforced.
  `EVIDENCE_BAR.programmatic` uses `uniqueWordCount >= 300`, matching E's
  threshold, and now additionally keeps the gated price index out of the
  index.
- **LCP under 1.5s on locality pages** — **not adopted as a target.** The
  repo pins `lcpMs: 2500` in `performance/budgets.json`, which is Google's
  published "good" threshold and what the SLO alerts on. Lowering the number
  in a config file does not make a page faster, and 1.5s cannot be verified
  in CI. What *is* enforced on locality routes is the HTML byte budget —
  `/buy/ahmedabad/paldi/` is one of the six routes with a hard 128 KB cap —
  plus the JS and image budgets, which are the things that actually move LCP.

---

## What changed

**New**

| File | Purpose |
| --- | --- |
| `app/price-index/page.tsx` | The hub: every city, published or withheld. |
| `app/price-index/[city]/page.tsx` | The per-city report, gated. |
| `client/src/lib/seo/price-index.ts` | Metadata, `Article` + `BreadcrumbList` JSON-LD, hub head, outbound links. |
| `client/src/components/architech/NotesList.tsx` | Titled list. Exists so `role="list"` lives where ESLint allows it — see below. |
| `client/src/lib/seo/price-index.test.ts` | 14 tests. |
| `client/src/lib/seo/urls.ts` | `priceIndexPath/Url`, `cityPriceIndexPath/Url`. |

**Changed**

| File | Change |
| --- | --- |
| `client/src/lib/seo/serp.ts` | `fitTail()`; `localitySerpTitle` now ladders real data; price-index SERP helpers. |
| `client/src/pages/CityPage.tsx` | Nearby localities 4 → 5. |
| `client/src/lib/seo/pages.ts` | `report` route type, 13 pages registered, indexability from the report's gate. |
| `client/src/lib/seo/sitemap.ts` | `reports` segment. |
| `scripts/seo/raw-html-smoke.mjs` | 3 price-index routes and the `reports` sitemap added. |
| `client/src/lib/seo/serp.test.ts`, `pages.test.ts` | New ladder tests; registry count formula. |

**Why `NotesList` is a component.** Two rules disagree about `role="list"` on
a `<ul>`: `design-token-discipline.test.ts` requires it on every `<ul>`
(Safari + VoiceOver drop list semantics once Tailwind's preflight removes
list-style, and the item count is information), while the default jsx-a11y
config that covers `app/**` treats it as a redundant role. `eslint.config.js`
resolves this for `client/src/**` only. Every one of the repo's 10 `<ul>`
elements is in a component; the new pages follow that rather than suppress
either rule.

---

## Verification

```
pnpm check     clean
pnpm lint      clean
pnpm test      749 passed / 83 files   (was 725 / 82)
pnpm test:seo  17 routes, 7 sitemaps   (was 14 routes, 6 sitemaps)
```

Re-scanned against the 449 prerendered routes:

| Metric | Before | After |
| --- | --- | --- |
| Locality pages with a bare title (no tail) | 15 / 72 | **0 / 72** |
| Locality titles carrying price or configuration | 0 / 72 | **66 / 72** |
| Truncated SERP titles | 0 | **0** |
| Locality pages linking 5 sibling localities | 0 / 72 | **72 / 72** |
| Public price-index pages | 0 | **13** (12 indexed, 1 gated) |
| Sitemap segments | 6 | **7** |
| Unsegmented pages | 0 | **0** |

Two of the new assertions caught real defects while being written, both fixed:

- The gated price-index description claimed a city was withheld because its
  sample was below the minimum. For Ahmedabad that is false — 4 listings
  against a bar of 3. The real blocker is that no *locality* qualifies. The
  snippet now carries the report's own `blockers` rather than a re-derived
  reason.
- `border-rule` / `border-rule-soft` are not Tailwind utilities in this
  theme, so the new pages' borders would have rendered invisible. Switched to
  the `border-ink/NN` convention the rest of the repo uses.

---

## Deliberately deferred

- **Project pages** — no `Project` model (`prisma/schema.prisma`).
- **"Near" pages** — would be thin slices of pages that already rank; E §6 and
  §7 both argue against.
- **Per-locality price-trend pages** — the locality page already carries its
  own trend band; splitting it out would duplicate and halve the signal.
- **500 → 3,000 page scale** — a data problem, not a template problem, and the
  evidence gate is what keeps the current 72 from being thin.
- **URL restructure to `/locality/…`** — would spend indexed equity on
  cosmetics.
- **Google Maps embed** — costs LCP against E's own §6 target; the unverified
  "signals relevance" claim does not justify it.
- **LCP 1.5s target** — 2500ms is Google's published threshold and what the
  SLO alerts on; the enforceable proxies are the HTML/JS/image budgets.
- **FAQPage, AggregateRating, Dataset markup** — restricted, absent, and
  overstated respectively.
- **`verifiedTransactions`** remains 0 (no IGR ingest) — the second arm of the
  evidence bar is still unused.
