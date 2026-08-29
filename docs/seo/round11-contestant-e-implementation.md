# StudyArena round 11 — Contestant E · implementation record

**Source file:** `docs/seo/4 studyarena-round11-contestant-e.md`
**Reviewed against:** the Architech Next.js 16 implementation as of 29 Aug 2026
**Implementation date:** 29 August 2026
**Decision authority:** `docs/seo/seo-recommendation-decision-register.md` (round-11 register)
**Depends on:** `docs/seo/round11-contestant-a-implementation.md`, `-b`, `-c`

Contestant E opens by naming the five structural weaknesses of Housing.com-type portals — thin/duplicate listings, generic templated area content, slow pages, weak hyperlocal long-tail, weak local pack — and builds ten recommendations against them. The diagnosis is accurate and the strategy converges with A, B and C.

Because three previous passes have already implemented most of what this document asks for, this pass is smaller in code and larger in verification. Its substantive change is one fragility repair in review markup. It also records **one place where Architech deliberately diverges** from E's advice (§9, canonicalisation of syndicated listings), where following the advice would work against the platform's own interest.

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

## §5a — `AggregateRating` safety: repaired (was safe by coincidence)

**Decision: Implemented.**

E asks for `AggregateRating`/`Review` — "**(genuine ones)**". That parenthetical is the whole requirement, and both existing registers are blunt about it: never add rating markup without eligible genuine content.

The guard was checked before changing anything. `meanRating()` filters to `source === "verified-buyer"` and returns 0 when there are none, and `buildAgentJsonLd()` omitted `aggregateRating` when `rating > 0` was false. Rendered output was confirmed clean — **no `AggregateRating` appears anywhere in the built HTML**, so no fabricated rating markup was shipping.

But the safety was **incidental, not asserted**. `buildAgentJsonLd` gated on `rating` alone, so the correctness of the markup depended on a *display* function's filtering choice. Two concrete problems follow:

1. A future change that averaged sample reviews into the rating for display purposes — a plausible product request — would silently begin publishing fabricated `AggregateRating` data, with nothing at the schema boundary objecting.
2. `rating > 0` does not imply `reviewCount > 0`. That combination is constructible (the profile type permits it), and an `AggregateRating` with `reviewCount: 0` is invalid markup.

The builder now asserts the invariant itself:

```ts
const hasGenuineReviews = profile.reviewCount > 0 && profile.rating > 0;
```

This decouples schema correctness from the display layer: review markup is now safe by construction rather than by coincidence. Four tests lock it in, including the specific regression — a profile constructed with `{ rating: 4.5, reviewCount: 0 }` emits no `aggregateRating` — and confirmation that sample-only review sets still produce none.

## §5b — Remaining schema

| Recommendation | Treatment |
|---|---|
| `RealEstateListing` on every property page | **Already implemented**, with `Offer`, `businessFunction` for lease vs sale, and `availability` mapped from lifecycle. |
| `BreadcrumbList` | **Already implemented** on every public route. |
| `FAQPage` on Q&A content | **Gated.** No page currently renders Q&A content, and the register permits `FAQPage` only for visible, editorially reviewed FAQs — adding it to manufacture snippets is a policy risk. The markup is ready to attach the moment real FAQ content exists. |
| `LocalBusiness` with multiple service areas | **Gated** on a real registered office and service areas. |
| `AggregateRating` / `Review` | **Implemented** (§5a). |
| `VideoObject` for walkthroughs | **Gated** on real, rights-cleared video. |

---

## §1 — Start with a wedge, not the whole country

**Decision: Already implemented — and the gate is what enforces it.**

E's warning is "spreading thin across India on day one = you rank nowhere." Read literally, the codebase contradicts this: it registers 12 cities and 72 localities.

The wedge is nonetheless intact, because **public indexing is gated off by default**. `PUBLIC_INDEXING_ENABLED` must be explicitly turned on for any of those pages to be submitted or indexed, and the gate is only meant to open after data, source, legal and SEO gates pass. Coverage breadth in the registry is not coverage in the index — the registry describes what *can* be published once the evidence exists.

This is worth stating plainly because it is easy to misread: 12 cities of **illustrative demo inventory** is not 12 cities of launch-ready depth. The one-city wedge discipline applies to what goes live, and today nothing does.

## §2 — Programmatic + hyperlocal page matrix

**Decision: Adapt. The gate now governs it.**

E proposes `/flats-for-sale/[locality]/[bhk]/[budget-range]/` generated for micro-neighbourhoods, societies and price brackets — "the scale trick big sites use — do it but with deeper content."

The scale trick is also the direct route to the scaled-content-abuse outcome. File 3 wired the quality gate that governs exactly this: a generated page lands in the `programmatic` kind and must clear the strict bar (≥6 live listings, a verified transaction, or ≥300 words of unique copy), plus approval, canonical, parent link, distinct data, methodology and source metadata. `/flats-for-sale/{locality}/{bhk}/{budget}/` is precisely the shape that bar exists to test.

On BHK and budget as URL segments specifically: Architech treats them as **query dimensions**, parsed by `client/src/lib/search/parse-query.ts`, for the same reason rent is not a URL segment (file 1). Each additional URL dimension multiplies the page count combinatorially; BHK × budget × locality across 72 localities is thousands of pages, nearly all of them thin.

## §3 — Win the long-tail ("Baner vs Wakad", "[society] review", "is Wagholi safe")

**Decision: Gated, and partly a content judgment.**

These query shapes are correctly identified as low-competition and high-intent. They are also all **editorial and data products**: a locality comparison needs comparable metrics and someone's honest judgment; a society review needs a building's data and a reviewer; "is X safe for families" is a claim about safety that Architech has no verified source for and should not synthesise.

A `/compare/` route exists for side-by-side listing comparison. Making it an indexable content surface would need real comparison content behind it, and it is currently a tool, not a page.

## §4 — Become the local data source

**Decision: Partly implemented; the link-earning core is gated.**

| Component | Treatment |
|---|---|
| Original monthly price report | **Gated** on real transaction/sold-price data with methodology. |
| Cite sources | **Already implemented** — locality facts carry a provenance trail and a visible source-trail section. |
| Author bios of licensed agents | **Gated** on real named, licensed people. |
| "Last updated" dates | **Already implemented** — sitemap `lastmod` (file 1), visible "updated on" locality facts (file 2), and an absolute per-listing stamp (file 3). |

The strategy itself is right and is Architech's stated authority approach: publish methodology-backed local data, earn citations from local journalists. It cannot start before the underlying data exists.

## §6 — Local SEO and the Maps pack

**Decision: Gated.**

E is correct that the local pack is where a genuinely local site can beat a national portal. Claiming a Google Business Profile requires a real, eligible, staffed location — the code cannot create one. This is recorded as an activation gate.

## §7 — Be faster than them

**Decision: Already implemented.**

Static/SSG rendering for every public route, WebP/AVIF, lazy-loading below the fold, an eager high-priority hero, explicit image dimensions, and per-route JavaScript budgets in `performance/budgets.json` with Core Web Vitals targets (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1).

## §8 — Freshness signal

**Decision: Substantially already implemented.**

Refresh timestamps now appear at every layer: sitemap `lastmod` from entity data (file 1), a visible "updated on {date}" line on locality price facts, and an absolute `Updated on {date}` stamp on each listing (file 3). Automated weekly price-trend updates and a "listed today" feed need a scheduled data pipeline, which is a production-data dependency.

## §9 — Clean canonical strategy — **DIVERGENCE**

**Decision: Deliberately not followed as stated.**

E advises: "If you syndicate listings, point canonicals to the original source to avoid duplicate-content penalties — this is exactly where portals bleed."

That is sound advice for a *syndicator* — a site republishing other people's inventory. Architech is a *platform*: it wants its own canonical property page to be the one that ranks. Pointing canonicals at external sources would hand every ranking to whichever upstream portal supplied the listing, and would leave Architech with nothing indexable to compound authority on.

Architech solves the same underlying problem (duplicate listings) the opposite way, and the round-11 register records this decision:

- one canonical page per property/unit;
- duplicate broker submissions consolidated onto it — `DUPLICATE` → `301` to the canonical listing id, backed by `Listing.canonicalToListingId` in `prisma/schema.prisma`;
- where consolidation is not possible, the duplicate is marked non-indexable.

The outcome E wants — no duplicate-content dilution — is achieved without ceding the canonical.

## §10 — Content clusters and internal linking

**Decision: Already implemented. Verified.**

E wants a pillar page per locality with supporting pages linking back up. Verified in rendered HTML for `/buy/ahmedabad/paldi/`:

- **up** → `/buy/` (national hub) and `/buy/ahmedabad/` (city hub)
- **sideways** → 4 sibling localities (`bopal`, `navrangpura`, `prahlad-nagar`, `thaltej`)
- **down** → 4 listing dossiers

That is a working cluster. The supporting pages E lists (schools, transport, projects) are currently on-page sections — commute stops, price bands, budget and BHK splits — rather than separate URLs, which is the right call until each could clear the quality gate as its own page.

---

## What shipped in this pass

| Change | File(s) |
|---|---|
| Review markup asserts the genuine-reviews invariant itself | `client/src/lib/agent/profile.ts` |
| Tests: zero-count rating, sample-only sets, genuine-rating path | `client/src/lib/agent/profile.test.ts` |

## Verification

```
pnpm check    clean
pnpm lint     clean
pnpm test     629 passed (75 files) — was 625 before this pass
```

Rendered-output checks:

- no `AggregateRating` anywhere in built HTML (confirmed before and after the change)
- `RealEstateAgent` node ships without rating markup when no verified reviews exist
- `/buy/ahmedabad/paldi/` links up to 2 hubs, sideways to 4 sibling localities, down to 4 listings

## What remains pending

1. **Google Business Profile per service area** and genuine reviews — real location required.
2. **Original local price reports** — the link-earning core; blocked on transaction data.
3. **Licensed-agent author bios, `LocalBusiness`, `VideoObject`** — real people, office and media.
4. **`FAQPage`** — ready to attach once real visible FAQ content exists.
5. **Automated price-trend refresh and "listed today" feeds** — scheduled data pipeline.
6. **Generated BHK/budget/locality pages** — gated behind the `programmatic` evidence bar.

## Status

**File 4 of 11 — complete.** Contestant E's document substantially overlaps A, B and C, and most of what it asks for was already implemented and verified rather than assumed. One fragility in review markup was repaired; one recommendation (§9) is consciously declined with reasoning.

Next in queue: `docs/seo/5 studyarena-round11-contestant-f.md`.

## References

[1]: https://developers.google.com/search/docs/appearance/structured-data/review-snippet "Google Search Central: Review snippet structured data"
[2]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam Policies"
[3]: https://developers.google.com/search/docs/specialty/local "Google Search Central: Local SEO"
[4]: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls "Google Search Central: Canonicalization and duplicate URLs"
