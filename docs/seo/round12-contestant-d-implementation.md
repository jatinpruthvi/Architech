# StudyArena round 12 — contestant D: implementation record

**Source:** `docs/seo/9 studyarena-round12-contestant-d.md`
**Branch:** `arena/01a04d70-architech`
**Scope:** the file is 7 sections plus a 90-day ordering. Most of it was already
built by files 1–8; this pass audits each section against the code, fixes what
is genuinely broken, and records where a recommendation was deliberately not
taken.

---

## D's thesis

> Don't try to out-muscle the portals on head terms. Out-structure them and
> out-niche them.

Concretely: programmatic locality pages with genuinely unique data (§1), server
rendering and split sitemaps so the long tail gets crawled (§2), schema that
describes what the page actually is (§3), at least one original data asset
nobody can copy (§4), visible authorship (§5), links earned rather than bought
(§6), and a list of things not to do (§7).

---

## Section-by-section: what was already true, and what changed

### §1 Programmatic locality pages — already built

D asks for one page per locality carrying data a portal would not bother
generating: median price, price per square foot, PIN code, trend direction,
amenity counts.

`/buy/[city]/[locality]` already does this across **72 localities**, and the
evidence gate added in file 7 (`EVIDENCE_BAR.programmatic` in
`client/src/lib/seo/page-quality.ts`) is what stops those pages from being the
thin doorways D warns about in §7. A locality page is only published when it
has `activeListings >= 6 || verifiedTransactions >= 1 || uniqueWordCount >= 300`.

**No change.**

### §2 Technical setup — one real gap, found by measuring the built output

D asks for SSR, split sitemaps, `noindex` on filter combinations, Core Web
Vitals discipline, and breadcrumbs marked up with schema.

| D asks | State |
| --- | --- |
| Server rendering | Every public route prerenders. No change. |
| Sitemaps split by type | Six already: pages, cities, localities, listings, guides, plus the index. No change. |
| Facet combinations `noindex` | `FACET_POLICY.indexable = false` in `client/src/lib/seo/facets.ts`. Left shut — see §7 below. |
| Core Web Vitals / images | **3716/3716** rendered images sit in a `<picture>` with a WebP `srcSet`, and **all 3716** carry `width`, `height` and `loading`. One exception, fixed. |
| Breadcrumbs + schema | 421/436 routes had `BreadcrumbList`. Now 425. |

The image audit is worth stating precisely, because the first attempt produced
a false result. Scanning `<img>` for `srcset` reports every image as missing
it — `Pic` puts `srcSet`/`sizes` on a `<source type="image/webp">` *inside*
`<picture>`, not on the `<img>`. Counting `<picture>` blocks instead gives the
real number: 3716 of 3716. The LCP image on a listing page is
`loading="eager" fetchPriority="high" decoding="async"`; the other nine are
`lazy`.

**Fixed in this pass:**

1. **The 404 page bypassed the image primitive.**
   `client/src/pages/NotFound.tsx` had a raw
   `<img src="/images/brick-arch.jpg">` — the only one of 3716 without WebP,
   a responsive source, intrinsic dimensions, or lazy loading. It now uses
   `Pic`. *Measured: images missing `width`/`height`/`loading` went 1 → 0.*

2. **Every social card was wrong or absent.** This turned out to be the
   substantive defect of the file, and it only became visible once the
   prerendered corpus was scanned as data rather than read as code:
   - The root layout hand-typed `1600x900` for `hero-ahmedabad.jpg`, which is
     **1376x768** — a 16% overstatement of width published on every route
     inheriting the default. It survived because the measured dimensions lived
     in `Pic.tsx`, which uses hooks and so cannot be imported by a server
     component.
   - **411 routes** with a page-specific `og:image` declared no dimensions at
     all.
   - Two guide routes emitted a **relative** `og:url` and image path. OGP
     requires absolute; crawlers resolve relative against whatever host served
     the page, so the card is only accidentally right on production.
   - **7 routes** had no card at all.

   *Measured after:* 435/436 routes carry an absolute `og:image` with measured
   dimensions; 0 relative; 0 undimensioned. The remaining one is
   `/sitemap.html` — a user-facing HTML sitemap, not a shared page.

3. **Guide JSON-LD was triplicated and had no breadcrumbs.** The same
   `Article` block was copy-pasted into all three guide route templates, and it
   had already drifted: two emitted a relative image path, one absolute. Now
   one builder (`client/src/lib/seo/guide-jsonld.ts`) emits `Article` +
   `BreadcrumbList`, and one `guideMetadata()` emits the head. The three
   templates are now three lines each.

**Breadcrumb decision.** 425/436 routes have `BreadcrumbList`. The 11 without
are deliberate:

- `/` is the root — there is no hierarchy above it.
- `/privacy`, `/terms`, `/contact-us`, `/about-us`, `/search`,
  `/home-loan`, `/investment`, `/requirements`, `/review`, `/sitemap.html` —
  legal and utility pages. A `Home › Privacy Policy` trail reports a hierarchy
  the user cannot navigate and adds nothing.

The guide hub `/guide/` **was** added, because it is now a parent node in the
silo its articles point back at, and `/buy/` — the other top-level hub —
already carried a two-crumb trail. Consistency with the existing pattern won.

### §3 Schema — applied selectively

D asks for `Product`/`Offer`, `BreadcrumbList`, `LocalBusiness` and `FAQPage`.

- **`BreadcrumbList`** — the only one not already present. Now on guides.
- **`Product`/`Offer` — not applied.** `Product` describes something sold
  through a checkout. Architech is a discovery platform with no transaction of
  its own, and marking inventory up as `Product` invites the merchant listing
  treatment Google reserves for sites that actually sell. Properties are
  modelled as `RealEstateListing` on listing pages, which is the documented
  type for it.
- **`LocalBusiness`** — not applicable to a national platform with no premises
  a customer visits.
- **`FAQPage`** — the decision register already withholds `FAQPage` markup:
  Google restricted rich results for it to authoritative government and health
  sites in 2023, so it earns nothing here.

### §4 Original data — already built

The market-trends / price-index report built in file 7 is exactly the
"one asset nobody can copy" D describes. No change.

### §5 E-E-A-T — already built

About and Contact pages exist; guides carry named authors and reviewers.
Deferred from file 8 and still deferred: `sameAs` links and RERA-numbered
author credentials, because the profiles are not claimed yet. Adding
`sameAs` pointing at an unclaimed profile is worse than omitting it.

### §6 Backlinks — operational, not code

Quality-only, no directories, no paid placements. Nothing to build; nothing in
the repo contradicts it.

### §7 Anti-patterns — honoured, including against D itself

D warns against thin programmatic pages, doorway pages, and indexable filter
combinations. The evidence gate and `FACET_POLICY.indexable = false` already
enforce this.

This is also why one part of D's own advice was **not** taken. §2 suggests
opening up some filter combinations; the facet policy stays shut because there
is no documented demand evidence, and the register forbids releasing indexable
combinations speculatively. D's own §7 outranks D's §2 here.

---

## What changed

**New**

| File | Purpose |
| --- | --- |
| `client/src/lib/media/intrinsic-sizes.ts` | Measured image dimensions, hooks-free so a server component can read them. Extracted from `Pic.tsx`. |
| `client/src/lib/seo/social.ts` | `socialImage()` / `defaultSocialImage()` — absolute URL plus measured dimensions, or a URL with none. Never guesses. |
| `client/src/lib/seo/guide-jsonld.ts` | One guide head: `guideMetadata()`, `guideJsonLd()`, `guideHubJsonLd()`, `guideBreadcrumb()`, `guideArticleUrl()`. |

**Changed**

| File | Change |
| --- | --- |
| `client/src/components/architech/Pic.tsx` | Imports the shared map; `PIC_INTRINSIC_SIZES` is now an alias of it, so there is one source of truth. |
| `app/layout.tsx` | Default card from `defaultSocialImage()`. Was `1600x900` and a relative URL. |
| `client/src/pages/NotFound.tsx` | Raw `<img>` → `Pic`. |
| `app/guide/page.tsx` | Hub JSON-LD from the shared builder; gains `BreadcrumbList`. |
| `app/guide/{city,locality,rera}/…/page.tsx` | Three near-identical templates collapse to `guideMetadata()` + `guideJsonLd()`. |
| `app/listing/[id]/page.tsx`, `app/buy/[city]/[locality]/page.tsx` | Cards from `socialImage()`. |
| `app/{about-us,contact-us,home-loan,investment,requirements,review}/page.tsx` | Were missing a card entirely; now carry the site default. |
| `scripts/seo/raw-html-smoke.mjs` | `assertSocialCard()` — every served route's `og:image` must be absolute and dimensioned. |

**Tests** — `client/src/lib/media/intrinsic-sizes.test.ts` (5),
`client/src/lib/seo/social.test.ts` (5),
`client/src/lib/seo/guide-jsonld.test.ts` (9).

---

## Verification

```
pnpm check          clean
pnpm lint           clean
pnpm test           725 passed / 82 files   (was 706 / 79)
pnpm test:seo       14 routes, 6 sitemaps   (now includes assertSocialCard)
```

Re-scanned against the 436 prerendered routes (framework `/_*` excluded):

| Metric | Before | After |
| --- | --- | --- |
| `<picture>` with WebP `srcSet` | 3716 / 3716 | 3716 / 3716 |
| `<img>` missing `width`/`height`/`loading` | 1 | **0** |
| Absolute `og:image` | 18 / 435 (rest relative) | **435 / 435** |
| `og:image` with measured dimensions | 18 / 435 | **435 / 435** |
| `og:image` declaring 1600x900 (wrong) | 18 | **0** |
| Routes with no card | 7 | 1 (`/sitemap.html`, by choice) |
| `BreadcrumbList` coverage | 421 / 436 | **425 / 436** |

**Regression guard verified non-vacuous.** `assertSocialCard` was exercised
against four synthetic inputs: correct card passes, relative URL fails, missing
dimensions fails, absent card passes.

---

## Deliberately deferred

- `Product`/`Offer` schema — wrong type for a discovery platform (§3).
- `LocalBusiness` — no customer-facing premises (§3).
- `FAQPage` — rich results restricted since 2023 (§3).
- Indexable facet combinations — D §2 requests, D §7 forbids; stays shut (§7).
- `BreadcrumbList` on the root and legal/utility pages — no real hierarchy.
- `sameAs` and RERA-numbered author credentials — profiles unclaimed (§5).

## Carried forward from file 8

- C §1 society pages — no `Project` model in `prisma/schema.prisma`.
- C §2 IGR ingest — `verifiedTransactions` remains 0.
- C §3 tranche release — no Search Console access, and page-count quotas are
  forbidden by the decision register.
