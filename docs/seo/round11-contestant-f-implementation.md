# StudyArena round 11 — Contestant F · implementation record

**Source file:** `docs/seo/5 studyarena-round11-contestant-f.md`
**Reviewed against:** the Architech Next.js 16 implementation as of 29 Aug 2026
**Implementation date:** 29 August 2026
**Decision authority:** `docs/seo/seo-recommendation-decision-register.md` (round-11 register)
**Depends on:** `docs/seo/round11-contestant-a/b/c/e-implementation.md`

Contestant F is the most explicit of the round-11 set about the failure mode that unites all five documents: locality pages that are "just templates with the locality name swapped in" get classified as doorway pages (§4). Most of F's recommendations were already implemented by the A–C passes. The value in this pass is that the doorway-page warning exposed a real weakness in the gate **I built in file 3** — and fixing it is the substantive change here.

---

## Decision legend

| Decision | Meaning |
|---|---|
| **Already implemented** | Present before this review; verified against rendered output. |
| **Implemented** | New code shipped in this pass. |
| **Adapt / Diverge** | Goal kept or consciously declined, with reasoning. |
| **Gated** | Correct, but needs verified data, accounts, rights, or legal review. |
| **Reject** | Creates a policy, quality, or measurement risk. |

---

## §4 — The doorway-page guard was weaker than it looked: **Implemented**

F's warning is specific:

> "If you create 5,000 locality pages that are just templates with the locality name swapped in, Google will classify them as **doorway pages** (spam policy violation) and ignore them. Instead, each locality page should have: actual price trend data, nearby schools/hospitals/metro distances, locality pros/cons written by someone who knows the area, original photos, resident reviews. **Quality > quantity.**"

File 3 wired the quality gate that is supposed to catch exactly this. Reviewing it against F's wording surfaced a defect in that work: for locality pages, `hasUniqueData` was **hardcoded `true`** in `client/src/lib/seo/page-gate.ts`, not derived.

That matters. `hasUniqueData` is one of the gate's hard requirements, and for the one page type most at risk of being a template with a swapped name, it was asserted rather than measured. A locality added to the registry with nothing but a name and coordinates would have sailed through. The gate was real for every other requirement and symbolic for this one.

**The fix** derives it from the locality's actual record — a place qualifies on any of:

- named landmarks with distances (schools, hospitals, transit), or
- the PIN codes it serves, or
- real aggregated price facts

A registry entry carrying nothing of its own now fails, which is precisely the page that should not be published.

### Measured before wiring, because the same trap was already hit once

File 3 found that a flat `activeListings >= 6` bar would have `noindex`ed all 72 locality pages. Before changing this requirement, the coverage was measured:

| Signal | Localities lacking it (of 72) |
|---|---|
| Named landmarks | **60** |
| PIN codes | 0 |
| Price facts | 2 |
| **All three** | **0** |

Every locality has at least PIN codes, so the derivation is non-regressive — all 72 still publish, and the "0 pages held back" assertion still holds. But the measurement also exposed a content gap worth stating plainly: **60 of 72 locality pages have no landmark data**, so most of them clear the distinct-data bar on PIN codes alone. That is a weak form of "distinct" compared with what F asks for, and it is a content backlog item rather than something code can fix. The gate is now honest about what it is checking; it is not yet checking everything F would want.

Two tests cover both directions: a locality confirmed to have its own data indexes, and one without does not.

---

## §1 — Win the long tail

**Decision: Already implemented.**

F's targets ("2 BHK under 80 lakhs in Whitefield", "apartments near Metro station HSR Layout", "gated community villas in Sarjapur Road") decompose into BHK, budget, and landmark. Architech serves all three:

- **BHK and budget** are parsed query dimensions in `client/src/lib/search/parse-query.ts`, with real URL parameters.
- **Landmark and property type** are filters over real inventory.
- **Locality pages** carry the structured facts that make long-tail queries answerable: PIN codes, named commute stops, price bands, BHK and budget splits, RERA coverage.

F's own condition — "their micro-locality pages are often thin; create genuinely better locality pages" — is the strategy in place, and §4 above is the guard that keeps "better" true as coverage grows.

## §2 — Technical setup

| Recommendation | Treatment |
|---|---|
| URL structure `/city/locality/property-type/` (e.g. `/pune/baner/2-bhk/`) | **Diverge.** Architech uses `/buy/{city}/{locality}/` with property type as a query dimension. Adding property type as a URL segment multiplies the page count combinatorially — 72 localities × property types × BHK is thousands of pages, nearly all thin — and each would have to clear the quality gate independently. This matches the decisions recorded for rent (file 1) and BHK/budget (file 4): intent and attribute are dimensions, not URL tiers. F's "clean, logical" requirement is met; "keyword-rich" is deliberately traded away in exchange for not generating index bloat. |
| Speed / Core Web Vitals | **Already implemented** — SSG for every public route, WebP/AVIF, lazy-loaded galleries, eager high-priority hero, per-route JS budgets, CWV targets (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1). |
| Mobile-first | **Already implemented** — `width=device-width, initial-scale=1` verified in rendered HTML. |
| XML sitemaps segmented by property type/locality with accurate `lastmod` | **Already implemented (file 1)**, segmented by **content type** rather than property type: `pages` / `cities` / `localities` / `listings` / `guides`. Property type is not a URL dimension here, so it cannot be a sitemap partition without creating the pages first. `lastmod` is derived from entity data and is never the build clock. |
| Canonical tags preventing duplicate listings from multiple brokers | **Already implemented** — one canonical page per property, `DUPLICATE` → 301 to `canonicalToListingId`. See the §9 divergence note in file 4 for why Architech does not canonicalise outward to upstream sources. |
| `noindex` faceted filter combinations | **Already implemented** — `client/src/lib/seo/facets.ts`, plus `Disallow` for `/search/` and `/saved/`. File 2 upgraded this from a stub to a real qualification gate. |

## §3 — Structured data

**Decision: Already implemented; one element gated.**

F asks for `RealEstateListing` with `name`, `url`, `image`, `address` (`PostalAddress`), `geo` (`GeoCoordinates`), `offers` (price, currency), plus `BreadcrumbList` everywhere.

All present and verified in rendered HTML. `address` and `geo` live on the `about` → `Residence`/`Apartment`/`SingleFamilyResidence` node rather than on the listing itself, which is more accurate modelling: the *place* has the coordinates and address, the listing is about that place.

`aggregateRating` — which F correctly qualifies with "(if you have reviews)" — is **gated**, and file 4 closed a fragility in how that gate is enforced.

## §5 — E-E-A-T

| Recommendation | Treatment |
|---|---|
| RERA registration number visible | **Gated, deliberately.** A `ReraRecord` model, a `Listing.reraRecordId` relation and a verification provider all exist, so the contract is in place. What is missing is verified data: the fixture registration number is a demo artefact (`…-DEMO`), and publishing it as a trust signal would be an unsupported claim. The register is explicit — show registration data "only when verified through an approved source and attached to the correct project/listing." The right fix is real RERA data, not plumbing. |
| Real author bylines with credentials | **Gated** on real named, credentialed people. |
| Physical office address + phone on Contact | **Gated** on a real registered office. |
| About page with real team photos | **Gated** on real photography and consent. |
| Google Business Profile | **Gated** on an eligible staffed location. |

## §6 — Authority through data

**Decision: Strategy adopted; execution gated.**

Publishing original research ("Bangalore Property Price Index Q3 2026") that journalists cite is the correct link strategy and matches Architech's authority/outreach contracts. It requires real transaction data with published methodology — source, period, geography, sample size, update date — before the first report can ship.

**Rejected, consistent with F's own warning:** PBN links, paid directory spam, and keyword-stuffed anchor text. All three are recorded as unacceptable in the existing registers.

The neighbourhood comparison tools and YouTube tours F suggests are gated on interactive-tool product work and rights-cleared video respectively.

## §7 — Timeline

**Decision: Rejected as a forecast.**

F's table promises "long-tail traffic growing 30–50% MoM" at months 6–12. Traffic growth at that rate cannot be guaranteed by any implementation, and the register rejects ranking and traffic promises outright. The *sequencing* is sound and matches how Architech is built — technical foundation, then data-backed content, then authority, then expansion. The numbers attached to it are not adoptable.

The "50–100 quality locality pages in months 1–3" target is also declined as a quota, consistent with rejecting contestant C's 300-page target and contestant B's 150–300 project pages. Architech expands on evidence, not on a count.

## "Your best hack" — one city or one property type

**Decision: Already implemented; see the §1 note in file 4.**

The registry lists 12 cities, which reads as contradicting this. The wedge is preserved by the `PUBLIC_INDEXING_ENABLED` gate: nothing is submitted or indexed until data, source, legal and SEO gates pass. Registry breadth is not index coverage.

---

## What shipped in this pass

| Change | File(s) |
|---|---|
| Locality `hasUniqueData` derived from the locality record instead of hardcoded | `client/src/lib/seo/page-gate.ts` |
| Tests covering both directions of the distinct-data requirement | `client/src/lib/seo/page-quality.test.ts` |

## Verification

```
pnpm check    clean
pnpm lint     clean
pnpm test     (see commit) — SEO suites 72 passed
pnpm test:seo 20/20 checks
```

Coverage measurement behind the derivation — 72 localities, 60 without landmarks, 2 without price facts, 0 without all three. Confirmed non-regressive: 0 pages held back after the change.

## What remains pending

1. **Locality landmark data** — 60 of 72 localities lack named schools/hospitals/transit distances. This is the largest gap against F's §4 content list.
2. **12-month price-trend history** — locality pages show a current price snapshot, not a trend series.
3. **Locality pros/cons** — requires real editorial judgment per place.
4. **Original locality photography and resident reviews.**
5. **RERA registration numbers** — verified source access required.
6. **Author bylines, office address, team photos, GBP.**
7. **Original research reports, comparison tools, video tours.**

## Status

**File 5 of 11 — complete, and round 11 is complete.** The substantive change repaired a weakness in the file-3 gate: the one requirement guarding against template locality pages was asserted rather than measured. It is now derived from each locality's own record.

Next in queue: `docs/seo/6 studyarena-round12-contestant-a.md` — the start of round 12.

## References

[1]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam Policies (doorway pages, scaled content abuse)"
[2]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to structured data"
[3]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Google Search Central: Build and submit a sitemap"
[4]: https://developers.google.com/search/docs/appearance/core-web-vitals "Google Search Central: Core Web Vitals"
