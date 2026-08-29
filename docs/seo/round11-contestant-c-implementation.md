# StudyArena round 11 — Contestant C · implementation record

**Source file:** `docs/seo/3 studyarena-round11-contestant-c.md`
**Reviewed against:** the Architech Next.js 16 implementation as of 29 Aug 2026
**Implementation date:** 29 August 2026
**Decision authority:** `docs/seo/seo-recommendation-decision-register.md` (round-11 register)
**Depends on:** `docs/seo/round11-contestant-a-implementation.md`, `docs/seo/round11-contestant-b-implementation.md`

Contestant C's framing — exploit portal weaknesses (generic content, stale listings, slow pages) rather than attacking head terms — matches the direction of A and B. The distinguishing contribution is §2, **programmatic SEO**: generate pages from a database of variables across a shared template. That recommendation is sound and it is also the highest-risk item across all eleven documents, because it is the direct route to the scaled-content-abuse outcome that contestant C's own §5 warns about.

This pass therefore centres on the guardrail that makes programmatic generation safe — and in doing so found that the guardrail already existed, had tests, and was wired to nothing.

---

## Decision legend

| Decision | Meaning |
|---|---|
| **Already implemented** | Present before this review; verified, not re-built. |
| **Implemented** | New code shipped in this pass. |
| **Adapt** | Goal kept, mechanism changed to fit the architecture or Google policy. |
| **Gated** | Correct, but needs verified data, accounts, rights, or legal review. |
| **Reject** | Creates a policy, quality, or measurement risk. |

---

## The headline finding: the quality gate was dead code

`client/src/lib/seo/page-quality.ts` defined a full indexability gate — editorial approval, canonical ownership, parent link, distinct data, methodology, source metadata, and an evidence threshold. It had a test file. It was **imported by nothing in the application**.

That matters because §2 recommends generating pages at scale from a template, and this module is the only thing standing between that and a thin-page penalty. A gate that no caller consults is not a gate.

### Why wiring it as-written would have broken the site

The gate's evidence bar was a single flat rule: `activeListings >= 6`. The actual distribution of live listings per locality:

| Listings per locality | Localities |
|---|---|
| 1 | 6 |
| 5 | 66 |
| **≥6** | **0** |

**Not one locality page clears a 6-listing bar.** Wiring the gate unchanged would have marked all 72 locality pages `noindex` and emptied the locality sitemap. That is almost certainly why it was never wired — and it is the strongest possible argument against a single flat threshold.

A locality page with five real homes, its own aggregated price facts, PIN codes, named commute stops, coordinates and an editorial note is not a thin page. It is not a doorway page either: a doorway page is a near-duplicate with a swapped place name and no substance of its own.

### The fix: an explicit per-kind evidence bar

The bar is now declared per page kind, with the justification beside the number:

| Kind | Applies to | Evidence bar |
|---|---|---|
| `locality` | `/buy/{city}/{locality}/` | ≥1 live listing **and** distinct locality data |
| `listing` | `/listing/{id}/` | the listing itself live and sourced |
| `hub` | city hubs, national hub, `/guide/` index | aggregated data of its own |
| `standing` | home, about, contact, tools, list-property | distinct purpose and content |
| `editorial` | guide detail pages | ≥300 words of reviewed copy, or verified data |
| `programmatic` | **future generated project / landmark / amenity / facet pages** | ≥6 listings, a verified transaction, or ≥300 words — the original strict bar |

**The strict bar is preserved, not lowered — it is aimed.** Contestant C's generated `property-type × neighbourhood × landmark × amenity` pages are exactly the `programmatic` kind, and they get the full original threshold. The relaxation applies only to place pages, where a 6-listing floor measures inventory depth rather than page quality.

This is honest calibration, not a number tuned to pass. Regression tests lock the behaviour in: a locality with five listings passes, a locality with zero fails, and a programmatic page with five listings and no unique copy fails.

### Wiring

`client/src/lib/seo/page-gate.ts` (new) derives each page's real inputs — live listing counts from the repository, guide word counts from actual section copy, sourced-freshness from `meaningfulUpdatedAt` — and exposes the decision. `getPublishableSeoPages()` in the registry intersects registry intent with the gate, and **the sitemap now publishes only from that set**, so a held-back page can never be submitted however it entered the registry.

`getHeldBackPages()` surfaces every held page with its reasons: held-back pages are a worklist, never a silent drop.

Current state: **zero pages held back**, and a test asserts that. The gate is wired to catch *future* thinness — a locality whose listings all expire, a listing that loses its update date, a generated page that ships without unique copy — not to re-litigate the pages that legitimately qualify today.

---

## §1 — Hyper-local long-tail keywords

**Decision: Adapt.**

Targeting "2 BHK near Magarpatta IT park with EV charging" instead of "2 BHK apartments in Pune" is right, and matches the strategy already in place. The mechanism differs: Architech does not create a landing page per query string. Long-tail demand is served by locality pages carrying structured, distinguishable facts (PIN codes, commute stops, price bands, BHK and budget splits, RERA coverage), and by the search grammar in `client/src/lib/search/parse-query.ts`, which parses BHK, budget, intent, category, filters, city, locality and PIN from free text.

Creating a page per long-tail query is precisely the doorway pattern §5 warns about. Dedicated pages are created where a page has independent reason to exist and clears the quality gate — not because a query exists.

## §2 — Programmatic SEO

**Decision: Adapt — the guardrail now exists; generation stays gated.**

Covered in full above. The template-plus-variables approach is viable for Architech, and the route registry already supports adding surfaces as a registry edit. Generation stays off until each generated page can clear the `programmatic` bar, which requires verified inventory, distinct data and documented demand. The example URLs (`/villas-near-dps-school-gurgaon`, `/pet-friendly-apartments-indiranagar`) would need named amenity and landmark data before any of them could qualify.

## §3 — Deep structured data

**Decision: One correction implemented; the rest already accurate.**

| Recommendation | Treatment |
|---|---|
| `RealEstateListing` | **Already implemented.** |
| `SingleFamilyResidence` or `Apartment` | **Implemented.** The schema emitted the generic `Residence` for every listing. It now maps from the listing's own subtype: `Flat/Apartment` → `Apartment`, `Villa` → `SingleFamilyResidence`, with `Residence` as fallback. Google reads the specific types far more precisely than the generic one. Non-residential subtypes (Office, Shop, Plot, Land) deliberately keep the fallback rather than being typed as residences — claiming `Residence` for an office would be a false statement in markup, and those types need their own modelling before they carry residence-shaped facts. |
| `Offer` with price and currency | **Already implemented**, including `businessFunction` for lease vs sale and `availability` mapped from lifecycle. |
| `Place` / `PostalAddress` with geo-coordinates | **Already implemented** on both listing and locality pages. |

## §4 — Hyper-niche neighbourhood guides

**Decision: Gated.**

Original street-level photography, resident interviews, distances to tech parks and upcoming metro stations, street-level price history, and embedded walking tours are all real-world assets. The locality pages already carry named commute stops, PIN codes, trust summaries and provenance-labelled price facts — the structured half of this. The experiential half (photography, interviews, video) is a media-rights and field-operations dependency, recorded as a gate.

## §5 — Core Web Vitals

**Decision: Already implemented, with one item rejected.**

Next-gen formats (WebP/AVIF), lazy-loading below the fold, eager hero with priority, explicit image dimensions, a CDN, and minimised JavaScript all exist and are enforced by route budgets in `performance/budgets.json`.

**Rejected: "aim for a PageSpeed Insights score of 90+".** A Lighthouse score is a lab diagnostic on a synthetic run, not a ranking factor and not a substitute for field data. The register is explicit: measure the 75th-percentile Core Web Vitals (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) from real users. Chasing a lab score encourages optimising for the test rather than for users.

## §6 — Clean, updated inventory only

**Decision: Implemented (with one correction), plus a visible-text bug fixed.**

The "ghost listing" diagnosis is accurate and Architech already treats it as a product problem: the lifecycle matrix in `client/src/lib/seo/lifecycle.ts` maps `SOLD` → 200 but `noindex`, `EXPIRED`/`REMOVED` → 410, `DUPLICATE` → 301 to canonical, and keeps a page with verified continuing value visible with alternatives.

**Added: a prominent absolute freshness stamp.** Listings previously showed only a relative label ("Updated 2 days ago"), which cannot be checked against anything — the same opacity that lets portals leave stale inventory up. Each listing now also carries `<time datetime="…">Updated on 24 Aug 2026</time>`.

**The label reads "Updated on", not "Verified on".** The underlying field is `meaningfulUpdatedAt` — when the listing's *facts* last changed. It does not assert verification, so the markup does not claim it. Rebranding a content-change date as a verification claim, on a site Google treats as money-or-life, would be exactly the kind of unsupported trust signal the existing registers reject.

**Bug fixed:** the listing header hardcoded the city — `{property.locality}, Ahmedabad` — so every dossier across all 12 cities rendered "Bandra West, Ahmedabad" in visible page text. This is the same bug class as the breadcrumb fix in file 1; it now reads from the listing's own city. Visible text matters more than markup here: this was wrong content shown to users, not just to crawlers.

## §7 — Dominate the Google Map Pack

**Decision: Gated, and two specific tactics rejected.**

Claiming and optimising a Google Business Profile is correct and is already recorded as an activation gate — it needs a real, eligible, staffed location; the code cannot create one.

**Rejected: "aggressively collect 5-star reviews".** Soliciting only five-star reviews is review gating, which violates Google's review policies and risks the profile itself. Genuine, consented, moderated reviews — or none.

**Rejected: "include your target keywords naturally in the review responses".** This is keyword stuffing into user-facing content. Review responses should answer the customer, not target a ranking.

---

## What shipped in this pass

| Change | File(s) |
|---|---|
| Per-kind evidence bar; the strict bar retained for programmatic pages | `client/src/lib/seo/page-quality.ts` |
| Registry → gate wiring from real data | `client/src/lib/seo/page-gate.ts` (new) |
| Sitemap publishes only gate-approved pages; held-back pages reported | `client/src/lib/seo/pages.ts`, `client/src/lib/seo/sitemap.ts` |
| Specific schema types (`Apartment`, `SingleFamilyResidence`) | `client/src/lib/listing-vocabulary.ts`, `app/listing/[id]/page.tsx` |
| Absolute `Updated on {date}` stamp with `<time datetime>` | `client/src/pages/ListingPage.tsx`, `client/src/lib/i18n.ts` |
| Fixed hardcoded city in listing header | `client/src/pages/ListingPage.tsx` |
| Tests: gate calibration (14) and publication enforcement (3) | `client/src/lib/seo/page-quality.test.ts`, `client/src/lib/seo/sitemap-contract.test.ts` |

## Verification

```
pnpm check    clean
pnpm lint     clean
pnpm test     625 passed (75 files) — was 611 before this pass
pnpm build    clean
```

Rendered-HTML checks against a production build:

- `/listing/garden-courtyard/` (flat) → `"@type": "Apartment"`
- `/listing/thaltej-dusk-house/` (villa) → `"@type": "SingleFamilyResidence"`
- listing header → `<time dateTime="2026-08-24">Updated on 24 Aug 2026</time>`
- Mumbai listing → `Bandra West, Mumbai` (previously hardcoded `…, Ahmedabad`)
- quality gate → 0 pages held back; every published page clears its bar

## What remains pending

1. **Programmatic page generation** — routes are registry-ready; each surface needs verified inventory, distinct data and documented demand to clear the `programmatic` bar.
2. **Project / landmark / amenity data** — required before any of contestant C's example URLs can qualify.
3. **Neighbourhood guide assets** — street-level photography, resident interviews, walking tours.
4. **Google Business Profile** — real eligible location; genuine reviews only.
5. **Field Core Web Vitals** — lab budgets enforced; 75th-percentile field data needs real traffic.

## Status

**File 3 of 11 — complete.** Every code-completable recommendation is implemented, verified against a production build, and covered by tests. The most important change is not a new feature but a repair: the quality gate that makes programmatic SEO safe now actually runs.

Next in queue: `docs/seo/4 studyarena-round11-contestant-e.md`.

## References

[1]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam Policies (scaled content abuse)"
[2]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to structured data"
[3]: https://developers.google.com/search/docs/appearance/core-web-vitals "Google Search Central: Core Web Vitals"
[4]: https://developers.google.com/maps/ugc "Google Maps user-generated content policy"
