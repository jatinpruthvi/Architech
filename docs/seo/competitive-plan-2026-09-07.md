# SEO competitive plan — 2026-09-07

Audit-driven. Generic SEO advice is worthless for this repo: canonicals, sitemap
segmentation, structured data, crawl simulation, and a publish-time quality gate
already exist and already pass. So this plan targets only gaps that a real audit
confirmed, ranked by the traffic they unlock against 99acres / MagicBricks /
Housing.com.

The competitive read: those incumbents win on inventory volume, and they pay for
it with enormous thin-page surfaces. Architech cannot out-volume them and should
not try. The edge is **only publishing pages backed by real inventory** — which
is what the existing gate enforces, and what everything below preserves.

## Findings and disposition

| # | Gap | Evidence | Status |
|---|---|---|---|
| 0 | `transactionType` silent bug | `mappers.ts` read a column absent from schema *and* DB; every prisma-mode listing became "buy" | **Fixed** |
| 1 | No rent vertical | `/rent/**` returned 404; `intent: "rent"` had zero callers | **Shipped** |
| 2 | No `FAQPage` schema | zero matches repo-wide; real FAQ UI unmarked | **Shipped — About + all locality pages, both intents** |
| 3 | Hindi content dark | `titleHi`/`descriptionHi` exist, zero `.tsx` usages, no `hreflang` | **Deferred — see below** |

### 0. `transactionType` (bug, fixed first)

`mappers.ts` mapped `row.transactionType`, but the column existed in neither the
Prisma schema nor the database. Every listing read through prisma silently
became `buy`. Rent work built on top of that would have been built on sand, so
this was fixed first: schema field, enum, migration `202609070002`, ledger
reconciled.

### 1. Rent vertical (largest gap)

"Property for rent in {locality}" is roughly half of Indian property search
intent and the site answered none of it.

Buy and rent are **separate registry entries**, not a query parameter. This is
load-bearing: the quality gate then judges each independently, and a rent page's
`activeListings` counts *rental* listings only. One URL cannot be the canonical
answer to both "for sale" and "for rent".

Schema follows GoodRelations: rent uses `LeaseOut`, buy uses `Sell` — the
distinction that stops an aggregator reading a ₹22,000/month figure as a sale
price.

**The split exposed a pre-existing bug.** Bopal and Satellite were publishing
"homes for sale" pages whose only inventory was rentals. Intent-scoping the gate
withheld them. Only 4 of 12 rent locality pages currently publish. That
asymmetry is the gate working, not a defect.

Rent city hubs additionally require `rentals > 0` to satisfy the hub test's
"aggregated data of its own". Without that, all 12 would have shipped as empty
boilerplate hubs — 12 doorway pages on day one. They publish automatically once
rental stock exists.

**Verified end-to-end:** flipping one listing to `RENT` moved
`/buy/ahmedabad/paldi/` out of the sitemap and `/rent/ahmedabad/paldi/` in,
driven purely by inventory. Data restored afterwards.

### 2. `FAQPage` schema

Real FAQ UI existed on the About page with no markup, and locality pages had no
FAQ at all — a direct loss of "People also ask" and AI-answer surfaces.

Two rules encoded in `lib/seo/faq.ts`:

- **Schema mirrors visible content.** Google issues manual actions for marked-up
  answers users cannot see. `buildFaqPage` consumes the same array the component
  renders, so drift is structurally impossible rather than merely discouraged.
- **No fact, no question.** Every `localityFaqEntries` generator returns nothing
  when its underlying fact is missing, and `buildFaqPage` returns `null` below
  two entries. A data-less locality contributes no FAQ instead of a templated
  non-answer repeated across 72 pages — templated FAQs *are* a doorway signal.

The RERA answer describes the checking policy and never asserts registration,
consistent with the repo's no-invented-facts rule.

**Coverage.** FAQ schema is live on the About page and on every publishable
locality page in *both* intents — the buy pages are the larger prize, since 68
of them publish against 4 rent pages today.

**Price wording is intent-aware.** A rent page asks "what is the average rent",
answers with a monthly median, and discloses that deposit, maintenance, and
brokerage are excluded. A buy page asks about price and answers with a sale
median. Conflating them is the error that leads an aggregator to read
₹22,000/month as a purchase price, so the two never share wording.

Both medians are sourced from fields that are already `null` unless the sample
is large enough to read as a locality summary (`medianPriceInr`,
`medianMonthlyRentInr`). In the current dataset both are below that floor, so
the price question correctly does not appear on any page — the module declining
to answer rather than publishing a figure one listing wide.

**The visible-content rule is enforced by a test, not a convention.**
`faq-visibility.test.ts` reads the actual route sources and fails any page that
calls `buildFaqPage` without rendering the same named array, including the
indirect case where the UI lives in a component sharing one content module. It
was verified by deliberately deleting a render and confirming the failure. Unit
tests on `faq.ts` cannot catch this: the real failure mode is a *page* that
emits schema and forgets the copy.

One implementation note worth keeping: the About copy lives in
`lib/content/about-faqs.ts`, not in the client component. A plain array exported
from a `"use client"` module and imported by a server component crosses the RSC
boundary as a client reference, not data, and the prerender fails with
`a.filter is not a function`. Shared data must live in a module neither side
marks client-only.

### 3. Hindi / `hreflang` — deferred, with a trigger

`titleHi` and `descriptionHi` exist in the schema and are unused. Shipping
`hreflang` now would be actively harmful:

1. **The columns are empty.** `hreflang` pointing at pages that fall back to
   English creates duplicate clusters across two locales instead of one.
2. **`hreflang` is a bidirectional contract.** Unreciprocated or partial
   annotations are ignored at best and split signals at worst. It needs a
   complete `hi-IN` route tree, not a flag.
3. **Machine translation would breach the repo's own standard.** Locality copy
   carries RERA and price context; auto-translating it manufactures unreviewed
   claims in a language no reviewer here reads.

**Trigger to revisit:** when ≥ 60% of published locality pages have
human-reviewed `titleHi`/`descriptionHi`, ship `hi-IN` routes and reciprocal
`hreflang` together in one change — never `hreflang` alone.

## What was deliberately not done

- **No new programmatic surfaces** (project/landmark/amenity/facet pages). They
  are where doorway risk lives, and the inventory to back them does not exist.
  Competitors' thin pages are their weakness, not a template to copy.
- **The buy city hub was left un-scoped**, so no pre-existing verdict moves.
- **`organization.ts` still omits `address`/`sameAs`/`telephone`** — withheld
  pending identity verification. Not an SEO gap.

## Verification

`tsc --noEmit` clean · lint clean · **1898 tests passing** ·
`build:ci` succeeds · SEO smoke: 19 routes, 8 sitemaps, 2 AI index files ·
crawl-simulation: 578 pages, no broken links, no orphans, self-canonicals hold,
depth within budget · performance budgets pass.

Rendered output was checked against a production build: a locality page emits
exactly four `Question` nodes and renders exactly those four questions, with the
answer text present in the raw HTML for crawlers that do not run scripts.

The crawl gate earned its keep here: it caught the rent hubs as orphans
(sitemap-advertised, unreachable by link) before commit, which is why `/buy/`
now carries cross-intent links.
