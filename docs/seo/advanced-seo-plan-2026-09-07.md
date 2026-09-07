# Advanced SEO: what wins once the site is live

A second, deeper pass — written after auditing the *whole* live surface rather
than the SEO library alone. The first plan
(`competitive-plan-2026-09-07.md`) closed obvious functional gaps: a missing
rent vertical, missing FAQ schema, a `transactionType` bug. Those were table
stakes. This document is about the layer above that, where the competitive
outcome is actually decided.

## What the audit found

I inventoried all 47 route families against the SEO registry. The headline is
that the *infrastructure* is genuinely strong and largely finished:

- Canonicals, trailing-slash policy, 8 segmented sitemaps, IndexNow, GSC
  hooks, an image sitemap, `llms.txt`, an AI-crawler policy.
- A publish-time quality gate that already withholds thin pages.
- A crawl simulator that fails the build on orphans and broken links.
- `/blogs` is a clean prerendered redirect to `/guide/`; `/locations/{state}/`
  and `/locations/postal-codes/{code}/` are deliberately `noindex` pending a
  per-record source gate. Those are **decisions, not oversights** — I verified
  each before treating it as a gap.

So the remaining upside is not more pages or more tags. It is **coherence**.

## The gap that mattered: entity fragmentation

Architech emitted 28 distinct schema types, but almost every place node was
**anonymous**:

| Page | What it said about Ahmedabad |
|---|---|
| `/buy/ahmedabad/` | a `City` named "Ahmedabad" |
| `/rent/ahmedabad/` | a *different* `City` named "Ahmedabad" |
| `/buy/ahmedabad/bopal/` | a *third* `City` named "Ahmedabad" |
| `/price-index/ahmedabad/` | `about: { Place, name: "Ahmedabad" }` |
| every listing | `addressLocality: "Bopal"` — a bare string |

Repo-wide there were only 9 `@id` values, none of them on a city or locality.

To a search engine those are hundreds of unrelated blobs that share a name.
Nothing accumulates. This is *the* structural difference between a site that
mentions Bopal and a site that Google understands **is an authority on Bopal** —
and it is the layer where 99acres and MagicBricks are weakest, because
disconnected per-page markup is what large template-driven portals produce by
default. Out-publishing them is impossible; out-*structuring* them is not.

### What shipped

`lib/seo/entity-graph.ts` — stable `@id`s derived from canonical URLs, plus
`ref` / `namedRef` / `cityNode` / `localityRef` helpers.

Three rules encoded:

1. **One entity, one id, everywhere.** A city's id is anchored on its *buy*
   URL in both intents. Buy and rent are two views of one real place; saying so
   is what stops the two URLs competing as separate entities.
2. **Exactly one page defines an entity; everywhere else references it.**
   `cityNode()` returns a bare reference by default and the full definition only
   on `{ full: true }`. The safe option is the default, because ~500 pages
   mention a city and none of them should re-describe it.
3. **State ids are anchored on `/locations/`, not `/locations/{state}/`,**
   because the per-state route is `noindex`. An `@id` must not point at a URL
   crawlers are told to ignore.

Verified live across five page types — all resolve to one identifier:

```
/buy/ahmedabad/          → .../buy/ahmedabad/#city
/rent/ahmedabad/         → .../buy/ahmedabad/#city
/buy/ahmedabad/bopal/    → .../buy/ahmedabad/#city
/rent/ahmedabad/bopal/   → .../buy/ahmedabad/#city
/price-index/ahmedabad/  → .../buy/ahmedabad/#city
```

The graph is traversable in both directions: the city hub lists its localities
via `containsPlace`, and every listing points up through
`containedInPlace → locality → city → state → India`.

`entity-graph-integrity.test.ts` enforces this against the real route sources —
it fails any page emitting an anonymous `City` or `Place`, and asserts that only
the buy city hub defines a city. **It immediately caught a fork I had missed on
`/rent/{city}/`**, which was still emitting its own City node. That is the bug
class the test exists for, found on its first run.

## Deliberately not built

Ranked by what I considered and rejected, with the reason:

- **`Speakable` schema.** Only supported for news publishers in a small number
  of locales. Emitting it here signals nothing and risks looking like markup
  spam.
- **`AggregateRating` on localities.** The single fastest way to a manual
  action. There are no consented, moderated reviews to aggregate, and the repo's
  own rule forbids inventing them.
- **Programmatic facet pages** (`3-bhk-in-bopal`, `under-1-cr-in-thaltej`).
  This is the biggest *apparent* opportunity and the biggest real trap. With 6
  listings, every such page is a doorway page. The trigger to revisit is
  inventory density, not ambition: no facet page should exist until its own
  filter returns enough live stock to satisfy the existing quality gate.
- **`sameAs` / social identity on `Organization`.** Withheld pending identity
  verification, consistent with the standing decision in `organization.ts`.
- **PIN-code and state pages.** Already built and already `noindex` behind a
  documented source gate. Publishing them is a *data* decision, not an SEO one.

## What to do when real inventory arrives

The honest constraint today is 6 listings. The work above is what makes volume
*compound* when it lands, rather than arriving as noise:

1. **Rent pages publish themselves.** Already proven end-to-end: flipping one
   listing to `RENT` moved a locality out of the buy sitemap and into the rent
   sitemap automatically.
2. **The price index becomes the citation magnet.** It is already gated on
   minimum sample size and already attached to the city entity via `about`.
   Journalists cite indices, not listings — this is the one authority lever that
   cannot be bought.
3. **Then, and only then, facets.** Gated on live stock per facet.
4. **Hindi/`hreflang` last**, on the trigger already written down: ≥60% of
   published localities carrying human-reviewed Hindi copy, shipped as routes
   and reciprocal annotations together.

## Verification

`tsc --noEmit` clean · lint clean · **1956 tests passing** · `build:ci`
succeeds · SEO smoke: 19 routes, 8 sitemaps, 2 AI index files ·
crawl-simulation: 578 pages, no broken links, no orphans, self-canonicals hold ·
performance budgets pass · entity ids confirmed against rendered production
HTML on five page families.
