# StudyArena round 12 — contestant B: implementation record

**Source:** `docs/seo/7 studyarena-round12-contestant-b.md`
**Date:** 30 August 2026
**Branch:** `arena/01a04d70-architech`

---

## What B asked for

B's thesis is that a new domain cannot beat Housing.com on head terms, so it
should win on hyper-specificity, speed, content depth, and original data. Six
recommendations: programmatic hyper-local landing pages, data journalism for
backlinks, informational long-tail guides, perfect Core Web Vitals, advanced
structured data, and exploiting zero-search-volume keywords.

The strategy is sound and mostly already reflected in the decision registers.
Implementing it surfaced five defects in the data the strategy depends on.
Four are fixed here; one is recorded as a gate.

---

## Summary of changes

| # | B § | Change | Outcome |
|---|---|---|---|
| 1 | §1 | Amenity categories moved from name-guessing to declared data | 11 of 30 mislabeled places corrected; new landmarks cannot ship unlabelled |
| 2 | §2 | `price-trends.ts` no longer aggregates rent with sale prices | Median for Ahmedabad was off by ~28%; Bopal reported a rent as a sale price |
| 3 | §2 | Figures below a minimum sample are withheld, not published | Paldi's single listing is no longer shown as a locality "median" |
| 4 | §2 | Locality "vs city" baseline scoped to the locality's own city | Thaltej's comparison was against all of India, not Ahmedabad |
| 5 | §2 | New `market-trends.ts` report + API route | The linkable asset exists, and says plainly when it is not fit to publish |
| 6 | §3 | Stamp duty and registration rates consolidated to one registry | Two copies of a state rate that could drift |
| — | §4, §5 | Verified, no change needed | See below |

Tests: **684 passing across 78 files** (was 634 / 76). `pnpm check` and
`pnpm lint` clean. Production build clean. SEO smoke green at 14 routes and
6 sitemaps. Page gate unchanged: 431 publishable pages, 0 held back.

---

## 1 · Amenity categories are data now, not a guess (§1)

B asks for "a database of hyper-local amenities, tech parks, schools, and
transit stations" to power hyper-specific landing pages.

The database half of that is right and was missing. Locality landmarks were
`[name, distance]` pairs, and the *kind* of place was guessed by matching
substrings in the name. Measured against the 30 distinct places in the
registry, **11 were wrong**, and the label renders on the locality page:

| Place | Rendered as | Actually |
|---|---|---|
| EON IT Park (Kharadi) | Green | an employment hub — it matched `park` |
| ITPL (Whitefield) | Landmark | an employment hub |
| Financial District (Gachibowli) | Landmark | an employment hub |
| IIT Bombay (Powai) | Landmark | a university — the rule listed `iim` but not `iit` |
| Bandra Terminus | Landmark | transit |
| Bandra–Worli Sea Link | Landmark | transit |
| 100 Feet Road (Indiranagar) | Landmark | transit |
| Select Citywalk (Saket) | Landmark | retail |
| Gachibowli Stadium | Landmark | sports |
| Versova / Elliot's Beach, Adyar Estuary | Landmark | parks & waterfront |

`IIM Ahmedabad` rendered as *Schools & learning* while `IIT Bombay` rendered
as *Landmark*. That single inconsistency is the clearest evidence the
categoriser was never a good idea.

**Change.** `client/src/lib/realestate/amenities.ts` introduces a nine-value
`AmenityCategory` vocabulary (`transit`, `work`, `learning`, `health`, `green`,
`culture`, `retail`, `sports`, `landmark`). Every landmark in
`client/src/lib/localities.ts` now declares its category as a third tuple
element. Inference survives only as a fallback for database rows that predate
the field, and its rule order is fixed so employment is tested before green.

Two details that matter:

- **The fallback is testable and tested.** `amenities.test.ts` pins the 18
  names whose categories the old rules got wrong.
- **A new landmark cannot ship unlabelled.** A test walks every landmark in the
  registry and fails if any lacks a declared category. This is the real fix —
  the bug existed because a plausible-looking inference ran silently, so the
  gate makes silence impossible.

Verified in rendered HTML: `EON IT Park → Employment hub`, `ITPL → Employment
hub`, `IIT Bombay → Schools & learning`, `Bandra Terminus → Transit`,
`Gachibowli Stadium → Sports`, `Select Citywalk → Retail`.

**Not implemented: the landing pages.** B wants pages auto-generated for
"long-tail intersections" — *pet-friendly 2 BHK near [tech park]*. Intersecting
amenity × configuration × attribute is the doorway-page pattern this project's
own register rejects, and `FACET_POLICY` already refuses to index arbitrary
combinations. The round-12 register puts "near" pages at **Conditional**: the
route pattern is feasible, but pages stay gated until verified amenity data and
original editorial value exist. This change supplies the data half of that
condition; the editorial half is not code.

## 2 · Rent was being aggregated with sale prices (§2)

`priceNum` encodes a rental as **monthly rupees × 100** and a sale as total
rupees. `price-trends.ts` read it as one field.

Two published consequences:

- `localityPriceTrends("bopal")` returned `medianPriceInr: 2_200_000` and
  `avgPricePerSqftInr: 2_245` for a locality whose **only** listing is a flat
  renting at ₹22,000/month. A month's rent was published as a sale price.
- `cityPriceTrends("ahmedabad")` returned `medianPriceInr: 11_100_000` across
  6 listings — 4 sale prices mixed with 2 of those rentals. Excluding rent,
  the median of the 4 sale prices is **₹1.545 Cr**. The published figure was
  off by roughly 28%, with a rental as the city's cheapest "home".

This is served publicly by `/api/localities/[slug]/price-trends`.

**Change.** `split()` separates sale and rent before anything is computed.
`monthlyRentInr()` and `salePriceInr()` are the only way either is read, and
`RENT_PRICE_SCALE` documents the ×100 in exactly one place. Rent is now
reported as `medianMonthlyRentInr` in rupees per month, never combined with
capital values.

The ×100 encoding itself is pre-existing and has many consumers, so it is
documented and converted rather than changed — re-scaling it is a data-model
refactor with its own blast radius, and not this file's job.

## 3 · A median of one is not a median (§2)

The locality page rendered `compactInr(intel.medianPriceInr)` under the label
**"Median asking"**, with a "Based on 1 home" note. For Paldi that printed
**₹1.85 Cr** — one home's asking price, labelled as a locality median.

The sample size was disclosed, which is why this survived review. But the
label still said median, and "₹1.85 Cr" is the number a reader remembers.

**Change.** `MIN_SAMPLE_FOR_PUBLISHED_STAT = 3`. Below that, `medianPriceInr`,
`minPriceInr`, `maxPriceInr`, `avgPricePerSqftInr` and the vs-city figure are
`null` — withheld on purpose, not missing by accident. `sampleSufficient`
carries the state so a caller can explain itself, and `published` does the same
on `PriceTrendSummary`.

Three is the floor because a median needs a middle observation: with one
listing the median is that listing's asking price, with two it is the mean of
two asking prices. It is deliberately lower than `FACET_POLICY.minListings`
(5), which decides whether a whole *page* is worth indexing — this decides
whether a single disclosed figure inside a table is arithmetic rather than
decoration. Every figure published at this floor still carries its sample.

Verified in rendered HTML:

| | Paldi (1 sale listing) | Bandra West (3 sale listings) |
|---|---|---|
| Median asking | — | ₹8.19 Cr |
| Avg ₹/sq ft | — | ₹52,843 |
| vs city median | — | +75% |
| Sample shown | Based on 1 active verified buy listings | Based on 3 active verified buy listings |

The page gate is unaffected: 431 pages publishable, 0 held back, because every
locality still qualifies on pincodes or landmarks.

## 4 · "vs city" was comparing against India (§2, found while building §2)

`cityPsf()` averaged **every buy listing in all twelve cities** and the
locality page labelled the result "vs city".

- All-India baseline: ₹12,059/sq ft (202 listings)
- Actual Ahmedabad baseline: ₹11,281/sq ft (4 listings)

Thaltej rendered **−10% vs city**. Against Ahmedabad's own baseline the honest
figure is **−4%**. The page overstated how far below its market Thaltej sits,
on a number B's whole recommendation is about making quotable.

**Change.** `cityPsf(citySlug)` is scoped to the locality's own city, and
returns null when the city has no comparable listings so the page shows "—"
rather than a comparison against the wrong denominator.

## 5 · The market-report asset, with the gate that makes it safe (§2)

`client/src/lib/realestate/market-trends.ts` produces the per-city,
per-locality table B wants, and `app/api/cities/[slug]/market-trends/route.ts`
serves it.

The measured finding is the important part. **Ahmedabad — the launch market —
has 6 listings across 6 localities: one each, and two of them rentals.** Every
other city has 30 (18 sale + 12 rent, so 3 sale per locality).

So the report says, rather than hiding:

- **Ahmedabad**: city aggregate publishes (4 sale listings, clearing the bar
  of 3), but **0 of 6 localities** do. `publishable: false`, with the blocker
  naming the gap. The micro-neighbourhood breakdown B's asset depends on
  cannot be built yet.
- **Mumbai and the other ten cities**: all 6 localities publish at 3 sale
  listings each. `publishable: true`.

Every report carries `methodology`, `limitations`, `asOfDate`, per-row sample
sizes, and a `coverage` block separating *thin* from *empty*. `blockers`
explains why a report is not publishable, so the gap is a worklist.

The asset is deliberately **not** wired to a public page. Publishing it and
pitching journalists are external work, and the register keeps data journalism
as *Keep with gate*. The gate is now real and callable rather than
described — which is the precondition for building the page safely.

## 6 · One registry for stamp duty and registration (§3)

`0.05` and `0.01` were written twice: as `DEFAULT_STAMP_DUTY` /
`DEFAULT_REGISTRATION` in `client/src/lib/cost/ownership.ts`, and as a `RATES`
literal in `app/api/cost/ownership/route.ts` whose comment claimed "Gujarat
defaults" while the constants themselves named no state.

Two copies of a state rate can drift, and the API could quote a buyer a
different stamp duty than the page shows for the same house.

**Change.** A `TRANSFER_CHARGES` registry in `ownership.ts` is the single
source; the route imports it and the result carries `charges` — which state's
rates were used, plus the scope note.

The registry deliberately holds **only Gujarat**, the one state with a
recorded rate. `transferChargesFor("Karnataka")` returns `null` rather than a
plausible guess: stamp duty is set per state, and a wrong figure is a
statutory number quoted to someone about to spend a crore of rupees. B's
"how to calculate stamp duty in [neighbourhood]" content needs this registry
filled per state first — which is why it is consolidated before that content
is written, not after.

---

## Verified, no change needed

**§4 · Core Web Vitals.** Already satisfied. Next.js App Router server-renders
and prerenders the public pages (the raw-HTML smoke suite enforces this),
route performance budgets exist, and field CWV is collected through
`/api/observability/web-vitals`. One part of B's recommendation is rejected:
"keep your Google PageSpeed Insights score above 90" is a lab score, and both
registers reject it as a ranking requirement. The 75th-percentile
LCP / INP / CLS thresholds stay.

**§5 · Structured data.** `RealEstateListing`, `Offer` and `Place` are already
emitted correctly — verified in `app/listing/[id]/page.tsx` (listing + offer)
and `app/buy/[city]/[locality]/page.tsx` (place, with `containedInPlace` up to
`City` and `AdministrativeArea`). B expects these to produce star ratings;
Architech deliberately emits `AggregateRating` only with genuine reviews
(round-11, contestant E), so no rich-result guarantee is claimed.

`FAQPage` is **not** added. Both registers mark it *Conditional* — visible,
editorially approved FAQs only, never markup manufactured for snippets. There
is no approved FAQ content in the codebase yet, so adding the schema would
mean adding content to justify markup, which is backwards.

## Not implementable in code

**§6 · Zero-search-volume keywords.** The advice — talk to brokers, publish
the hyper-specific question buyers are asking this week — is good, and the
editorial path already supports it: a guide page needs 300 words or a verified
transaction, with no impression-data requirement, so a genuinely new topic can
be published before any tool registers volume for it.

What cannot be done in code is the input: hearing what brokers are being
asked. There is no broker-question intake surface, and inventing one is a
product decision, not an SEO change. Recorded as an activation task.

**Scraping.** B suggests scraping for market data. The register rejects
scraped listings outright; every figure here derives from Architech's own
published inventory.

---

## Files changed

| File | Change |
|---|---|
| `client/src/lib/realestate/amenities.ts` | New — category vocabulary, declared-first resolution, row validation |
| `client/src/lib/realestate/amenities.test.ts` | New — 28 tests |
| `client/src/lib/realestate/market-trends.ts` | New — sample-gated city report |
| `client/src/lib/realestate/market-trends.test.ts` | New — 13 tests |
| `client/src/lib/realestate/price-trends.ts` | Sale/rent separation, unit helpers, sample gate |
| `client/src/lib/realestate/price-trends.test.ts` | Updated, +2 tests |
| `client/src/lib/realestate/locality-intel.ts` | Names categories, city-scoped baseline, sample gate |
| `client/src/lib/realestate/locality-intel.test.ts` | Updated, +2 tests |
| `client/src/lib/localities.ts` | All 33 landmarks declare a category |
| `client/src/lib/repositories/mappers.ts` | Validates amenity rows instead of casting |
| `client/src/components/architech/LocalityIntel.tsx` | Labels sourced from the vocabulary |
| `client/src/lib/cost/ownership.ts` | `TRANSFER_CHARGES` registry; result carries its charges |
| `client/src/lib/cost/ownership.test.ts` | +3 tests |
| `app/api/cost/ownership/route.ts` | Reads the registry; removes the duplicate `RATES` |
| `app/api/cities/[slug]/market-trends/route.ts` | New — serves the report |
| `client/src/lib/api-contract.test.ts` | +6 tests across the touched endpoints |

## Open items

- **Fill `TRANSFER_CHARGES` per state** before writing stamp-duty content. Gujarat only today.
- **Grow Ahmedabad inventory past 3 sale listings per locality** before the market-report page can publish a breakdown.
- **Broker-question intake** (§6) needs a product decision.
- **Original photography** remains gated on media rights and moderation.
