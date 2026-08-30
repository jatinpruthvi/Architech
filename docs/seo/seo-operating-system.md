# Architech as an SEO operating system

**Status:** design. Nothing here is built yet.
**Question this answers:** "whenever we add a listing from the UI or the
backend, it should rank first in Google."

---

## 1. The honest reframe, first

No architecture can make a listing rank first. Ranking is decided by Google,
against competitors, on queries where you do not control the supply of pages.
Anyone who tells you otherwise is selling something.

Three things *are* engineerable, and they are worth more than a ranking
promise:

1. **Latency.** A listing that Google has not crawled cannot rank at all.
   Cutting time-to-indexed from "whenever the next deploy happens" to minutes
   is a real, measurable win, and today it is the biggest one available.
2. **Eligibility.** The page is indexable, canonical, non-duplicate, fast, and
   passes the quality bar. This is table stakes and mostly built.
3. **Ownership of an entity query.** A listing page can realistically be the
   #1 result for *itself* — "Garden Courtyard, Paldi, Ahmedabad". Nobody is
   competing for that string. It is low volume, but it is winnable, it is
   where the enquiry converts, and it is the only ranking claim about a
   listing page that survives contact with reality.

And then there is the fourth, which is the one that actually matters and the
one nobody asks for:

4. **Compounding.** A new listing's largest SEO contribution is usually *not*
   its own page. It is that its facts feed the locality and city pages that
   compete for real volume, and that enough of them unlock price figures those
   pages are currently forbidden from publishing.

§6 puts a number on that. It is the most useful thing in this document.

So the goal is not "every listing ranks first". The goal is:

> Every listing is indexed within minutes, is unambiguously the canonical
> answer for the entity it describes, passes its data upward into the pages
> that compete for volume, and its marginal value to the site is computed and
> known at the moment it is created.

---

## 2. Where the pipeline breaks today

Measured against the code, not guessed.

| Stage | State |
| --- | --- |
| Listing approved in moderation | `moderateListingForServer` updates `lifecycle` and writes an `AuditEvent`. **That is all.** |
| Cache invalidation | **Zero** uses of `revalidatePath`, `revalidateTag`, or `unstable_cache` anywhere in `app/` or `client/src/`. |
| Sitemap | `app/sitemap/[segment]/route.ts` is `export const dynamic = "force-static"`. A new listing does not appear until the next build. |
| Search Console | `LiveGscProvider` throws by design ("awaiting domain verification and credentials"). It is read-only anyway — `fetchSnapshot()` only, no submit. |
| Indexing API / IndexNow | Absent. |
| Duplicate handling | `Listing.canonicalToListingId` exists in `prisma/schema.prisma` and is referenced by **nothing**. |
| Internal links | The locality page's listing grid is baked at build time. `getRelatedListings(id, 3)` is computed per render, so siblings appear — the locality hub does not update. |
| Quality gate | `page-quality.ts` evaluates the registry once **at module load**. It is a build-time report, not a publish-time gate. |
| Persistence | Default is **fixture** mode (`ARCHITECH_DATA_SOURCE`); the prototype's writes are in-memory. With Prisma off, a listing added through the UI does not survive the process. |
| Public indexing | `isPublicIndexingEnabled()` returns false in production unless `PUBLIC_INDEXING_ENABLED=true`. Nothing in this document matters until that is on. |

The single sentence version: **the site has excellent SEO *attributes* and no
SEO *pipeline*.** A listing can be published and nothing anywhere is told
about it.

One thing that does work: `/listing/[id]` never sets `dynamicParams = false`,
so an unknown listing id renders on demand rather than 404ing. The page
exists. It is simply invisible — no sitemap entry, no link from its locality
hub, no ping.

---

## 3. The architecture: SEO as a control loop

Not a set of page attributes. A pipeline that emits events, evaluates them,
measures outcomes, and feeds back.

```
  CREATE / UPDATE / LIFECYCLE CHANGE
              │
              ▼
   ┌──────────────────────┐
   │ 1. EVENT SPINE       │  one choke point. nothing publishes without it.
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 2. PUBLISH GATE      │  blocking. completeness, duplication, quality.
   └──────────┬───────────┘  fail → back to the broker with reasons.
              ▼
   ┌──────────────────────┐
   │ 3. QUERY TARGETING   │  what is this page the answer to?
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 4. DISCOVERY         │  revalidate → sitemap → Indexing API → IndexNow
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 5. AUTHORITY ROUTING │  links in from hub + siblings
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 6. AGGREGATION       │  feed locality/city/price-index facts upward
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ 7. MEASUREMENT       │  per-URL status, impressions, position
       └──────────┬───────┘
                  └──────► back to 3 (retarget) and 2 (re-gate)
```

### 3.1 Event spine

One function, called by every write path — broker draft submit, admin
moderation, backend import, CSV ingest:

```ts
emitListingEvent({ type: "listing.published", stableId, previousLifecycle })
```

`moderateListingForServer` is the natural home. Every other subsystem hangs
off this. If a path can publish without emitting, the OS has a hole, so the
gate belongs *inside* the transition, not beside it.

### 3.2 Publish gate (blocking)

`page-quality.ts` already defines what "good enough to index" means. It is
currently evaluated at module load over the whole registry. Move the same
predicate to the moment of the transition:

- Completeness: title, description, price, BHK, area, locality, PIN, coords,
  ≥1 image.
- Uniqueness: description is not a near-duplicate of another listing in the
  same locality (min-hash or trigram similarity; the broker copy-paste case is
  the common one).
- Canonical: if a near-duplicate exists, set `canonicalToListingId` instead of
  publishing a second page. The column exists and is unused.
- RERA: `reraNumber` present or explicitly marked not-applicable
  (`moderation.ts` already raises `missing_rera` as a warning — promote it
  per policy).

Failing the gate must produce **reasons a broker can act on**, not a boolean.
That is the difference between a gate and a wall.

### 3.3 Query targeting

Every listing declares the query it is the answer to. The shape:

```
{locality} + {bhk} + {transaction} + {entity name}
"2 BHK apartment for sale in Paldi, Ahmedabad — Garden Courtyard"
```

`serp.ts` already fits this to the SERP budget (48 chars after the brand
suffix) and `listingSerpTitle` already degrades a too-long editorial title to
a formula. What is missing is the **declaration**: the listing does not
currently state its own targeting, so nobody can measure whether the targeting
worked.

Add it as data, and the measurement loop in §3.7 becomes possible: you cannot
tell whether a page achieved its query if you never recorded the query.

### 3.4 Discovery

In priority order:

1. **Revalidate.** Tag the listing page, its locality hub, its city hub and
   the sitemap segment. `revalidateTag` — currently unused anywhere.
2. **Sitemap.** Either drop `force-static` on the segment route, or revalidate
   the tag on publish. A URL that is not in a sitemap depends on a crawl
   finding it by accident.
3. **Indexing API.** Google's Indexing API is scoped to `JobPosting` and
   `BroadcastEvent`; for ordinary pages the supported mechanism is **GSC URL
   inspection + request indexing**, which is quota-limited. That matters:
   indexing requests are a scarce resource, so they must be spent on pages
   that pass the gate, which is why the gate comes first.
4. **IndexNow.** Cheap, supported by Bing and others, and harmless. Not
   Google, but not nothing.

### 3.5 Authority routing

On publish, the listing must be reachable in ≤2 hops from the home page:

- locality hub → new listing (missing today until rebuild)
- new listing → locality hub (exists via breadcrumb)
- 3–5 sibling listings in the same locality (`getRelatedListings(id, 3)`
  exists; consider 5 where the layout allows)
- city hub → locality hub (exists)

### 3.6 Aggregation — the part that compounds

`localityIntel`, `price-trends` and `market-trends` all derive from the
listing set. A new listing changes:

- the locality's median, ₹/sq ft, BHK split, budget bands
- the city's aggregates
- the price index rows and coverage
- whether `EVIDENCE_BAR.programmatic` passes for that locality
- whether `MIN_SAMPLE_FOR_PUBLISHED_STAT` passes, which decides whether
  figures publish at all

This is where one listing moves something big. See §6.

### 3.7 Measurement

`gsc.ts` defines a provider that is demo-only and read-only. The OS needs
per-URL, per-listing facts:

- `URL Inspection`: indexed or not, and the reason when not
- impressions, clicks, average position, per page, per week
- the queries a page actually receives vs. the query it targeted (§3.3)

Then three automatic responses:

| Observation | Response |
| --- | --- |
| Published, not indexed after 7 days | Alert. Check canonical, gate status, robots, noindex. |
| Indexed, zero impressions after 30 days | The targeting is wrong or the query has no volume. Retarget, or accept it as a conversion page and stop expecting search volume. |
| Impressions, low CTR | The title/description is losing the click. `serp.ts` owns this; rewrite, do not truncate. |

---

## 4. The listing journey, target state

| Time | What happens |
| --- | --- |
| T+0 | Broker submits; admin approves. `listing.published` emitted. |
| T+0 | Gate runs. Pass → continue. Fail → back to broker with reasons. |
| T+0 | Page rendered, tags revalidated, sitemap entry live. |
| T+0 | Locality and city aggregates recomputed; hub links include it. |
| T+60s | Indexing request queued (quota-permitted); IndexNow ping sent. |
| T+1d | URL inspection. Record indexed / not indexed. |
| T+7d | Retry inspection if not indexed. Alert if still not. |
| T+30d | Compare impressions against the declared target query. Retarget or flag. |
| On SOLD/EXPIRED | `410`, sitemap removal, hub links dropped, aggregates recomputed — all from the same event. |

Today: T+0 is a row update, and then nothing until someone runs a build.

---

## 5. What "rank first" can honestly mean for a listing

| Query type | Volume | Winnable? | Who owns it |
| --- | --- | --- | --- |
| "2 BHK in Mumbai" | High | No, not for years | Portals |
| "2 BHK in Paldi Ahmedabad" | Low–medium | Yes, eventually | **Locality page** |
| "Garden Courtyard Paldi" | Very low | Yes, quickly | **Listing page** |
| "2 BHK 1200 sqft Paldi under 80L" | Low | Yes | Listing page, if it targets it |

The listing page's realistic ceiling is its own entity plus a long tail of
attribute combinations. That is a small number of visits per listing — but it
is high intent, and it is winnable. The locality page is where volume lives,
and listings are what make the locality page strong enough to compete.

An OS that promises #1 for every listing will disappoint. An OS that gets
every listing indexed in minutes, tells you exactly which listings to acquire
next to unlock which pages, and routes authority correctly, will compound.

---

## 6. The measurable part: marginal value of one listing

This is the concrete answer to "what happens when I add a listing", and it is
computable today from the existing gates.

`MIN_SAMPLE_FOR_PUBLISHED_STAT = 3` (sale listings) per locality.
`cityMarketTrends().publishable` additionally requires **at least one locality
in the city to publish**. Ahmedabad currently has **0 of 6**.

Measured now:

```
Ahmedabad  publishable = false
  blocker: "No locality in this city has enough sale listings to publish a median."
  coverage: 0/6 published, 4 withheld, 2 empty

  to unlock — 14 more sale listings:
    Paldi +2, Navrangpura +2, Prahlad Nagar +2, Thaltej +2, Bopal +3, Satellite +3
```

So: **fourteen specific sale listings flip the entire Ahmedabad price index
from withheld to published** — a page that earns links, plus per-locality
figures on six locality pages that currently print nothing, plus the
`reports` sitemap growing from 12 URLs to 13.

That is a far larger SEO outcome than any single listing page's ranking, and
unlike a ranking it is deterministic: add those 14 listings and the page
publishes. No algorithm in the middle.

**This is the feature to build first in the OS: an acquisition queue that
computes, for every locality and city, exactly how many listings of what type
are needed to unlock the next gate — and shows it to whoever is sourcing
inventory.** It turns SEO from a report into a worklist.

Generalising it:

| Gate | Threshold | What it unlocks |
| --- | --- | --- |
| `MIN_SAMPLE_FOR_PUBLISHED_STAT` | 3 sale listings | Locality median + ₹/sq ft; locality row in the price index |
| One locality publishing | ≥1 locality at 3 | The whole city's price index |
| `EVIDENCE_BAR.programmatic` | 6 active listings (or 1 verified transaction, or 300 words) | Locality page passes the quality gate |

---

## 7. Build order

Ordered by value per unit of effort, given what already exists.

| # | Piece | Effort | Depends on | Unblocks |
| --- | --- | --- | --- | --- |
| 0 | **Turn on persistence and public indexing** (`ARCHITECH_DATA_SOURCE=prisma`, `PUBLIC_INDEXING_ENABLED=true`) | Config | A database | Everything below is theatre without it |
| 1 | **Marginal-value queue** (§6) — **built** | Small | Existing gates | Tells you what inventory to acquire; no external dependency |
| 2 | **Event spine + publish gate** (§3.1, §3.2) | Medium | #0 | Stops thin/duplicate listings being published at all |
| 3 | **Revalidation + dynamic sitemap** (§3.4 1–2) | Medium | #2 | Cuts discovery latency from "next build" to seconds |
| 4 | **Authority routing on publish** (§3.5) | Small | #3 | New page is reachable in ≤2 hops |
| 5 | **Declared query targeting** (§3.3) | Medium | #2 | Makes measurement possible |
| 6 | **GSC per-URL ingestion** (§3.7) | Large | Domain verification + credentials | The feedback loop |
| 7 | **Indexing requests + IndexNow** (§3.4 3–4) | Medium | #6 | The last mile; quota-limited, so build after the gate |

#1 is the standout: it is small, needs no external integration, and changes
what the business does on Monday. It is built:

| File | Role |
| --- | --- |
| `client/src/lib/seo/acquisition-queue.ts` | The computation. `cityAcquisitionPlan(citySlug)`, `acquisitionQueue()`, `acquisitionHeadline()`. |
| `client/src/lib/seo/acquisition-queue.test.ts` | 16 tests. |
| `app/api/admin/acquisition/route.ts` | `GET`, gated on `moderation.queue.read`, `no-store`, recomputed per request. |
| `app/admin/acquisition/page.tsx` + `client/src/pages/AcquisitionQueue.tsx` | The worklist UI. |
| `app/price-index/[city]/page.tsx` | The public half: a withheld index now states exactly what would publish it. |

The one design decision worth recording here: the minimum ask is the **cheapest
single locality**, never the sum of every locality's gap. Publishing a city
index requires only one locality over the bar, so quoting the sum would send
someone sourcing 14 listings to unlock what 2 would unlock.

Against the committed fixture inventory: 12 cities, 1 index withheld
(Ahmedabad), 2 sale listings in Paldi to publish every index, 14 to reach full
coverage. Those numbers describe the fixture, not the market — step 0 still
comes first for them to mean anything.

---

## 8. Instrumentation — how you would know it worked

Track these, not rankings:

| Metric | Today | Target |
| --- | --- | --- |
| Median time from approval to sitemap inclusion | unbounded (next build) | < 60s |
| Median time from approval to Google-indexed | unknown (no measurement) | < 48h |
| % of published listings passing the gate first time | unmeasured | > 90% |
| % of ACTIVE listings indexed | unknown | > 95% |
| Localities publishing price figures | 66 / 72 | 72 / 72 |
| Cities with a published price index | 11 / 12 | 12 / 12 |
| Impressions per listing page at T+30 | unknown | measured, per declared target |

The last four rows are unknowable until §3.7 exists. That is the argument for
building measurement earlier than it feels natural — everything else is
guesswork without it.

---

## 9. What this cannot do

- Guarantee any ranking, for any query, ever.
- Make a listing page compete for a head term. Its ceiling is its entity.
- Work at all while `PUBLIC_INDEXING_ENABLED` is off and persistence is
  fixture-backed. Every number above assumes both are on.
- Substitute for supply. The Ahmedabad unlock needs fourteen real listings in
  six named localities; no amount of engineering produces those.
- Manufacture trust. `verifiedTransactions` is still 0 with no IGR ingest, so
  the second arm of `EVIDENCE_BAR` stays closed and the YMYL position stays
  weaker than it should be.

---

## Appendix: where the pieces would live

| Concern | Existing home | Note |
| --- | --- | --- |
| Lifecycle → HTTP/indexability | `client/src/lib/seo/lifecycle.ts` | Rules exist; propagation does not |
| Quality gate | `client/src/lib/seo/page-quality.ts`, `page-gate.ts` | Predicate is right; evaluate at publish, not at module load |
| Page registry | `client/src/lib/seo/pages.ts` | New pages must register here |
| Sitemap | `client/src/lib/seo/sitemap.ts`, `app/sitemap/[segment]/route.ts` | Segment route is `force-static` |
| SERP copy | `client/src/lib/seo/serp.ts` | Budget, ladder, and `fitTail` already there |
| Schema | `client/src/lib/seo/{guide-jsonld,price-index,organization}.ts` | Per-type builders |
| Search Console | `client/src/lib/seo/gsc.ts`, `monitoring.ts` | Demo, read-only |
| Listing facts | `client/src/lib/realestate/{locality-intel,price-trends,market-trends}.ts` | The aggregation layer |
| Publish path | `app/api/admin/moderation/listings/[draftId]/route.ts`, `client/src/lib/persistence/broker-store.ts` | The choke point for §3.1 |
