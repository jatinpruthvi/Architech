# StudyArena round 12 — contestant C: implementation record

**Source:** `docs/seo/8 studyarena-round12-contestant-c.md`
**Date:** 30 August 2026
**Branch:** `arena/01a04d70-architech`

---

## What C asked for

C's framing is the strongest of the six: you cannot beat a portal on authority,
so win on *information gain* and *page-level specificity*. Eight
recommendations (society-level pages, proprietary data, a gated indexation
threshold, entity trust, a facet whitelist, engineered freshness, answer-first
formatting, data journalism), a kill list, and a concrete page-spec generator
with `INDEX` / `HOLD` verdicts.

Most of the architecture C describes already exists. What did not exist was any
enforcement of the two numbers his generator prints at the top of every page
spec — **Title ≤60 and Meta ≤155**. That turned out to be the largest single
defect in the set, and it is fixed here.

---

## Summary

| # | C § | Change | Outcome |
|---|---|---|---|
| 1 | §7 + generator | SERP length budget for titles and descriptions | 131 → **0** titles over 60; 419 → **0** descriptions over 155, of 438 routes |
| — | §3 | Indexation gate | Already implemented, thresholds match C's exactly — verified |
| — | §6 | Engineered freshness | Already implemented — verified |
| — | §8 | Data journalism | Built in file 7 — reused here |
| — | §1, §2, §4 | Society pages, IGR data, `sameAs` / GBP | Recorded as activation gates |

Tests: **706 passing across 79 files** (was 688 / 78). `pnpm check` and
`pnpm lint` clean. Production build clean. SEO smoke green at 14 routes and
6 sitemaps, now including the SERP budget. Page gate unchanged: 431
publishable, 0 held back.

---

## 1 · The SERP length budget (§7 and the generator spec)

C's generator output opens with two constraints:

> **Title (≤60):** `2 BHK for Rent in Kalyani Nagar, Pune — 14 Verified`
> **Meta (≤155):** `14 verified 2 BHK properties for rent in Kalyani Nagar, Pune. Median ₹42,000/mo, ₹12,400/sq ft, +6.4% YoY. Updated Aug 2026.`

They matter because of his §7: the click is won or lost in the SERP, not on the
page. Past those lengths Google truncates, and the thing cut off is usually the
number that would have earned the click.

Measured across the 438 prerendered routes:

- **131 titles exceeded 60 characters** — worst, 76: `A furnished 2 BHK for rent in Greater Noida Alpha — ₹11,000 / mo · Architech`
- **419 of 438 descriptions exceeded 155** — worst, 229
- Nothing was checking. The smoke suite asserted a `<title>` element *existed*, which is not the same as it being readable.

**Change.** `client/src/lib/seo/serp.ts` makes the budget a measured property
rather than a convention. Two layers:

- `composeSerp*` builds the string from **priority-ordered parts**, appending
  each only while the result still fits. The most valuable clause survives at
  the expense of the lowest: a long locality name costs a tail clause, not the
  median price.
- `fitSerp*` is the hard backstop for a part that cannot fit at all, cutting on
  a word boundary.

The budget accounts for the brand suffix. The root layout sets
`title.template: "%s · Architech"`, so a page title has **48** characters, not
60 — an easy thing to miss and the reason 131 titles were over.

**Composition stops at the first part that does not fit, and always keeps the
first part.** An earlier draft kept trying later parts, and the test caught it
producing a listing page titled:

```
— ₹11,000 / mo
```

The subject (49 chars) overflowed the 48-char budget, so the price was emitted
with nothing it referred to. A lower-priority clause without the clause it
follows is worse than no clause. This is now a test, not a memory.

**Answer-first, which is the other half of §7.** Descriptions are composed so
the number leads. Verified in rendered HTML:

| Route | Title | Description |
|---|---|---|
| `/buy/mumbai/bandra-west/` | `Bandra West, Mumbai — homes & locality context · Architech` (58) | `Homes in Bandra West, Mumbai — PIN 400050. Median ₹8.19 Cr, ₹52,843/sq ft across 3 active listings.` (99) |
| `/buy/ahmedabad/paldi/` | `Paldi, Ahmedabad — homes & locality context · Architech` (55) | `Homes in Paldi, Ahmedabad — PIN 380007. Tree-lined, central, quietly established. GujRERA context, verified coordinates, and real distances.` (140) |
| `/listing/greater-noida-alpha-rent-2bhk-3/` | `2 BHK for rent in Greater Noida Alpha · Architech` (49) | `2 BHK · Ready to move · 980 sq ft in Greater Noida Alpha, Noida — ₹11,000 / mo. Verified partner, updated 1 day ago.` (116) |

Paldi prints no median because its sample is one listing — the gate from file 7
holds here too, and the snippet says what it can support instead.

**Why truncation alone was not the fix.** `fitSerpText` makes the budget
unbreakable, which means the budget test can never fail. So
`serp.test.ts` adds the opposite assertion: **no page in the current corpus is
truncated**. If a locality name or listing note grows past the budget, CI fails
and a human rewrites the copy, rather than shipping an ellipsis into Google's
results. A guarantee that cannot fail is decoration; this is the test that
keeps the guarantee honest.

**Enforced on served HTML too.** `scripts/seo/raw-html-smoke.mjs` now checks
title and description length, and rejects any ellipsis, for every route it
visits. Builder-level tests can miss the brand suffix the layout appends; this
runs against the string Google actually receives. It caught four static pages
the builder tests could not see, including `/buy/` at 63 characters and
`/collections/`, which had hand-written a second brand
(`… on this device | Architech`) that the template then doubled.

### Copy shortened to fit

Guides, layouts and hubs were hand-written and simply too long. Shortened, not
truncated:

| Where | Before | After |
|---|---|---|
| `app/layout.tsx` default | `Architech — Find the place before the address. Homes across India.` (66) | `…before the address.` (46) |
| `app/buy/page.tsx` | `Buy property in India — every city Architech covers` (63) | `…every city we cover` (55) |
| `app/buy/page.tsx` | description, 240 chars | 152 |
| `app/collections/page.tsx` | `Collections — saved homes on this device \| Architech` (64, double-branded) | `…on this device` (52) |
| `app/review/page.tsx` | `Feedback for Architech — India property discovery` (61) | `…— property discovery` (55) |
| `app/list-property/page.tsx` | description, 165 chars | 143 |
| `Paldi buying guide` | `…: reading a neighbourhood by its trees` (67) | `…: read a neighbourhood` (52) |
| `Ahmedabad home buying guide` | `…: place before address` (61) | `Ahmedabad buying guide: place before address` (56) |

---

## Verified, no change needed

**§3 · The indexation gate — already implemented, and it matches C exactly.**

C's threshold is "≥6 live listings *or* ≥1 verified transaction *or* ≥300 words
of unique local data, everything else `noindex, follow`". `client/src/lib/seo/page-quality.ts`
already encodes that as the `programmatic` evidence bar:

```
at least 6 live listings, a verified transaction, or 300 words of unique copy
```

and `evaluatePageQuality` already returns the verdicts `INDEX` and `HOLD` —
C's own vocabulary. Verified: 431 pages publishable, 0 held back.

C also asks for tranched release (~500/week) with GSC cohort monitoring. Not
implemented: without live Search Console it would be a counter that always
reads zero, and the round-12 register rejects fixed page-count quotas
("Architech uses quality-gated, evidence-backed expansion rather than a
page-count target"). The gate that decides *whether* a page may launch exists;
the schedule for launching them is an operating decision, not a code one.

**§6 · Engineered freshness — already implemented.** `dateModified` and
sitemap `lastmod` come from `Listing.meaningfulUpdatedAt` and locality fact
dates, never the build clock, and "Updated on" renders from that date. C's
warning about fake freshness stamps is precisely what the round-11 work
removed.

**§8 · Data journalism — built in file 7.** C's example is a "Pune Rental Yield
Report Q3 2026" with a downloadable dataset. `client/src/lib/realestate/market-trends.ts`
is the city-level equivalent, served at `/api/cities/:slug/market-trends`, with
methodology, limitations, per-row sample sizes and an explicit `publishable`
verdict. Pitching journalists is external work; the asset and its gate are code.

**Kill list.** `AggregateRating` without real reviews was closed in file 4.
Expired-domain redirects, PBNs and paid guest posts do not exist here.
Bulk-AI locality copy is not generated — locality notes are hand-authored data.

**§7 · Answer-first on the page.** Verified on `/buy/ahmedabad/paldi/`: the
page opens with a hero, then a numeric snapshot strip, then the price band as
the first major section. The numbers are high but not first. The SERP snippet
now carries the answer-first number, which is where C's argument actually
bites; moving it above the hero on the page is a design change.

## Not implementable in code

**§1 · Society and project pages.** C wants 3,000 of them. There is no
`Project` model in `prisma/schema.prisma` and no society-level data of any
kind. The round-12 register keeps this at *Adapt*: pages only when verified
project identity, RERA records, current inventory and distinct editorial value
exist. 3,000 empty pages is index bloat, which is the failure mode C's own §3
exists to prevent.

**§2 · Proprietary data (IGR transactions, ready-reckoner deltas, society
audits, litigation status).** C is right that this is the real moat, and it is
the right thing to build *before* content. None of it exists here: no IGR
ingest, no ready-reckoner rates, no society-level audits. `verifiedTransactions`
exists as a field in the quality gate with no source behind it, so it is
permanently 0 — the gate is ready, not fed.

**§4 · Entity trust.** `Organization` schema is emitted in `app/layout.tsx`
with name, URL, logo and `areaServed`, but has **no `sameAs`**. C wants it
consistent across GBP, LinkedIn, Crunchbase and the RERA agent registry. Those
profiles do not exist yet; adding `sameAs` would mean asserting URLs Architech
has not claimed, which is worse than omitting it. Named authors with RERA
registration numbers have the same problem — guide authors are desk names
("Architech Research Desk"), and the register forbids synthetic identities.

**§5 · Facet whitelist — a deliberate divergence.** C wants two combinations
whitelisted as indexable: `city + type + BHK + locality` and `city + type +
budget`. `FACET_POLICY` keeps every parameterised combination `noindex,
follow`, and file 5 decided property type, BHK and budget stay query
dimensions rather than URL segments. Opening those two combinations would need
documented demand, which is the same evidence that is missing everywhere else.
The gate is built and tested; it stays shut until Search Console says
otherwise.

**Crawlable pagination.** C's kill list names "infinite-scroll listings with no
crawlable pagination". Measured: `client/src/lib/search/pagination.ts` exists
with a 24-item page size used by the API, but there is **no pager UI** — the
rendered `/search/` HTML contains zero `page=` links, and everything past the
first page is reachable only by interaction. Search is `noindex, follow`, and
all 336 listings are in the segmented listings sitemap, so nothing is orphaned.
Building a visible pager is a product decision.

---

## Files changed

| File | Change |
|---|---|
| `client/src/lib/seo/serp.ts` | New — SERP budget, priority composition, truncation backstop, per-surface builders |
| `client/src/lib/seo/serp.test.ts` | New — 18 tests, including the no-truncation gate |
| `scripts/seo/raw-html-smoke.mjs` | Title and description length + no-ellipsis checks on served HTML |
| `app/listing/[id]/page.tsx` | Title and description composed against the budget |
| `app/buy/[city]/[locality]/page.tsx` | Same, with the median gated on sample size |
| `app/buy/[city]/page.tsx` | Same |
| `app/buy/page.tsx`, `app/review/page.tsx`, `app/collections/page.tsx`, `app/list-property/page.tsx`, `app/layout.tsx` | Over-budget static copy shortened |
| `client/src/lib/repositories/guides.ts` | Two guide titles shortened to fit |

## Open items

- **Ingest state IGR transaction data** — C's §2 is the real moat and the only
  recommendation here that would move `verifiedTransactions` off zero.
- **A `Project` model** before any society page work (§1).
- **Claim the real profiles** that would justify `sameAs` and RERA-numbered
  authors (§4).
- **Search Console**, which unblocks the facet whitelist (§5), tranche
  cohorts (§3), and the impression-per-page metric C wants as the single
  number to run on.
