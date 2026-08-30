# StudyArena round 12 — Contestant A · implementation record

**Source file:** `docs/seo/6 studyarena-round12-contestant-a.md`
**Question answered:** "do you have any better suggestion than current suggestion"
**Reviewed against:** the Architech Next.js 16 implementation as of 29 Aug 2026
**Implementation date:** 29 August 2026
**Decision authority:** `docs/seo/study-arena-round12-decision-register.md`, `docs/seo/seo-recommendation-decision-register.md`
**Depends on:** round-11 records A–F

Round 12 asks for improvements on the previous answers, so this document is denser and more specific than the round-11 set. Most of it restates what round 11 already produced, now verified. Its one substantive code finding is a **Core Web Vitals bug that no previous pass had surfaced**, because no pass had measured the images.

---

## Decision legend

| Decision | Meaning |
|---|---|
| **Already implemented** | Present before this review; verified against rendered output. |
| **Implemented** | New code shipped in this pass. |
| **Measured** | Verified empirically; result recorded even where it is short of the target. |
| **Gated** | Correct, but needs verified data, accounts, rights, or legal review. |
| **Reject** | Creates a policy, quality, or measurement risk. |

---

## §7 — Declared image dimensions were wrong on 5 of 7 assets: **Implemented**

A asks for explicit `width`/`height` on images and CLS below 0.1. Checking that against the real files found the opposite of the intent: the dimensions were explicit **and wrong**, which is worse than omitting them.

`client/src/components/architech/Pic.tsx` derived every image's height as `width / 1.5`, on the comment's claim that "1.5 is what every derivative in `/public/images` is cropped to." Measured against the actual files:

| Asset | Actual | Declared | Error |
|---|---|---|---|
| `hero-ahmedabad` | 1376×768 | 1376×917 | 149px |
| `locality-street` | 1264×848 | 1264×843 | 5px (ok) |
| `prop-courtyard` | 1200×896 | 1200×800 | 96px |
| `prop-light` | 1200×896 | 1200×800 | 96px |
| `prop-thaltej` | 1200×896 | 1200×800 | 96px |
| `brick-arch` | 896×**1200** (portrait) | 896×597 (landscape) | **603px** |
| `stepwell` | 896×**1200** (portrait) | 896×597 (landscape) | **603px** |

The assumption held for **one asset in seven**.

Why this matters more than a cosmetic bug: `width`/`height` tell the browser the intrinsic ratio so it can reserve the right space before the photo loads. A wrong ratio means wrong reserved space, so the page jumps when the image arrives — a direct CLS cost, and `hero-ahmedabad` is the **LCP element on the homepage**. The two portrait assets declared landscape were reserving half the height they needed.

**The fix** replaces the single ratio with a per-asset `PIC_INTRINSIC_SIZES` map carrying real measured dimensions, and the fallback is now explicitly a last resort.

**Preventing recurrence is the real fix.** The bug came from a comment that was true once and went stale silently. `client/src/components/architech/pic.test.ts` now reads the actual image files — parsing WebP and JPEG headers — and asserts the map against them, plus checks that the WebP derivative shipped in `srcset` has the same ratio, and that no portrait asset is declared landscape. An unmapped or re-cropped asset fails CI instead of quietly costing CLS.

Verified in rendered HTML after the change:

```
hero-ahmedabad   width="1376" height="768"    (was 917)
prop-courtyard   width="1200" height="896"    (was 800)
brick-arch       width="896"  height="1200"   (was 597)
```

### §7 remainder

| Recommendation | Treatment |
|---|---|
| AVIF/WebP derivatives | **Already implemented** — `<picture>` with a WebP `<source>`. |
| Responsive `srcset` + `sizes` | **Already implemented** — verified: `srcSet="/images/hero-ahmedabad-800.webp 800w, /images/hero-ahmedabad.webp 1376w" sizes="100vw"`. |
| `fetchpriority="high"` on the hero, no lazy-loading on it | **Already implemented** — `fetchPriority="high" loading="eager"`. |
| Lazy-load below the fold | **Already implemented.** |
| Descriptive alt text | **Already implemented** on listing images (`alt="A garden courtyard in Paldi, Paldi, Ahmedabad"`). The decorative hero uses `alt=""`, which is correct. |
| Avoid text embedded in images | **Already implemented** — headings and facts are real DOM text. |
| Original property photographs rather than stock-city hero images | **Gated.** The homepage hero is a stock city image. Original photography is a media-rights and field-operations dependency. |

---

## §6 — Crawl engineering

**Decision: Already implemented. Click depth measured.**

| Requirement | Treatment |
|---|---|
| Server-render / prerender important content | **Already implemented** — every public route prerenders; a raw-HTML smoke suite protects it. |
| One permanent URL per property | **Already implemented** (`/listing/{id}/`, with `Listing.stableId` in Prisma). |
| Self-referencing canonicals | **Already implemented** on every registered route. |
| Separate XML sitemaps for localities, projects, listings, articles | **Already implemented (file 1)** — `pages` / `cities` / `localities` / `listings` / `guides`. |
| Only canonical, indexable `200` URLs in sitemaps | **Already implemented** — the sitemap publishes from `getPublishableSeoPages()`, which requires registry indexability *and* the quality gate. Non-public listing states and unpublished guides are excluded. |
| Update `lastmod` only after meaningful changes | **Already implemented (file 1)** — `lastmod` comes from entity data, never the build clock. |
| Block internal search-result pages | **Already implemented** — `noindex,follow` plus `Disallow: /search/`. |
| Control faceted-navigation crawl traps | **Already implemented** — facet gate (file 2). |
| Link to priority pages through ordinary HTML links | **Already implemented** — verified crawlable `<a href>` links throughout. |
| Search Console + GA4 from day one | **Gated** on real accounts. |

### Click depth — **Measured**

"Keep important pages within three clicks of the homepage," measured by breadth-first search over the prerendered HTML:

| Page type | Depth from homepage |
|---|---|
| City hubs (12) | 1 |
| Guide index | 1 |
| Locality pages (72) | 2 |
| Guide detail (3) | 2 |
| Listings — 6 featured | 1 |
| Listings — 7 | 2 |
| Listings — **259** | 3 |
| Listings — **64** | **4** |

**77% of listings are within three clicks**, along with every city hub and locality page. The 64 at depth 4 are deep inventory reached through a longer chain.

This is recorded as measured-rather-than-met rather than fixed, for two reasons. First, all 336 listings are submitted directly in a segmented XML sitemap, so discovery is not blocked — the three-click heuristic predates sitemap-centric discovery. Second, pulling them within three clicks would mean rendering far more listing cards on each locality page, trading a real page-weight and CLS cost against a guideline that is already satisfied by the sitemap. If the inventory shape changes, this measurement should be re-run.

---

## §1 — Narrow beachhead

**Decision: Already implemented; enforced by the indexing gate.**

One city, 5–10 localities, one transaction type, one audience. The registry lists 12 cities, which reads as contradicting this — but `PUBLIC_INDEXING_ENABLED` is off by default, so nothing is submitted or indexed until data, source, legal and SEO gates pass. Registry breadth is not launch breadth.

The positioning example ("verified 2 and 3 BHK resale properties in Whitefield, with society fees, commute times, water availability, recent transaction prices") is exactly the shape Architech's locality pages aim at. Several of those specific data points — society fees, water availability, flooding history, registered transactions — are not present and are recorded as gates below.

## §2 — Pages around actual search intent

**Decision: Already implemented.**

The proposed hierarchy adds `flats-for-sale/`, `2-bhk-flats-for-sale/`, `villas-for-sale/` and a project page beneath each locality. Those are attribute and project dimensions; Architech treats the first three as query dimensions (consistent with the rent, BHK and budget decisions in files 1–5) and gates project pages on verified project data.

The rule A attaches is implemented verbatim: *"Only index a filter when it has search demand, enough active listings, and unique content."* That is precisely `evaluateFacetGate()` from file 2 — demand, inventory, unique content, stable URL and parent link, with demand as an explicit input so the gate stays shut without impression evidence.

## §3 — Information Housing.com often cannot provide

**Decision: Partly implemented; the richer half is gated.**

A's ten-element locality page, scored against what exists:

| Element | Status |
|---|---|
| 1. Current verified listings | Present |
| 2. Price trends | **Partial** — current snapshot (median, range, avg ₹/sq ft); no 12-month series |
| 3. Locality map | Present |
| 4. Commute table | **Partial** — named landmarks with distances, but only 12 of 72 localities have them (measured in file 5) |
| 5. Cost-of-ownership calculator | Present (`OwnershipCost`) |
| 6. Nearby infrastructure | **Partial** — same landmark coverage gap |
| 7. Pros and cons | Absent — needs real editorial judgment per locality |
| 8. Recent registered transactions | Absent — needs IGR/source data |
| 9. FAQs | Absent |
| 10. Author, sources, update date | **Partial** — sources and update date present; named author gated |

Also absent and gated: registration and maintenance costs, water supply and flooding history, noise/parking/power-backup/walkability, broker and resident quotes, original photographs and video.

## §4 — Trustworthy listings

**Decision: Mostly already implemented; one element gated.**

Present: mapped location, images with descriptive alt text, price/area/₹-per-sq-ft/availability, floor, facing, parking, agent identity (`RealEstateAgent`), similar properties, and the full expiry matrix (keep live with "no longer available" where there is continuing value; `410` only when there is none; no blanket redirect to the homepage).

**Gated — visible report-inaccuracy option.** A asks for one explicitly. A correction contract exists (`/api/rera/corrections`, `requestReraCorrection`), but it is **RERA-specific and permission-gated** (`rera.corrections.write`) — it is not a public "report an inaccuracy on this listing" path. Building one means new public write surface with abuse protection, moderation and routing, which is a product and security decision rather than an SEO change. It is recorded as a gate rather than improvised here.

On the "Verified on 25 August 2026" stamp: file 3 added an absolute date, deliberately labelled **"Updated on"**. The underlying field is `meaningfulUpdatedAt` — when the facts last changed. It does not assert verification, so it must not say "verified".

## §5 — Structured data

| Recommendation | Treatment |
|---|---|
| `Organization`, `WebSite`, `BreadcrumbList` | **Already implemented.** |
| `RealEstateAgent` | **Already implemented** (file 4 hardened its rating markup). |
| `Residence` / `Apartment` / `House` | **Already implemented** — now the specific type per listing (file 3): `Apartment` for flats, `SingleFamilyResidence` for houses. |
| `Offer`, `PostalAddress`, `GeoCoordinates` | **Already implemented.** |
| `ImageObject` | **Gated** — needs real media objects with rights and dimensions; §7 above fixed the `<img>` attributes, which is the part that carries the CLS benefit. |
| `Article` for guides | **Already implemented** — verified `Article` on guide detail routes. |
| `Person` for guides | **Gated.** Guide `author` values are desk names ("Architech Research Desk"), not named humans. Emitting `Person` would create the synthetic author identity the register prohibits. `Person` ships when real named, credentialed authors exist. |
| No self-serving review stars, fake ratings, or FAQ markup for rich results | **Already implemented** — file 4 tied rating markup to genuine reviews; `FAQPage` is used only for real visible FAQs, and there are none today. |

## §8 — Local authority

**Decision: Gated.** Local newspapers, housing-society guides, architects/lawyers/advisers, quarterly locality-price reports, embeddable calculators, infrastructure trackers, expert commentary, verified Google Business Profiles for real staffed offices. The authority and outreach contracts exist; every item needs real relationships, real data or a real office. Paid link packages, PBNs, mass guest posting and fake city offices are rejected — consistent with A's own warning.

## §9 — Fewer, better articles

**Decision: Adopted; gated on editorial capacity.**

The guidance ("avoid '10 tips for buying a home' unless you have original expertise") matches the register's editorial gates. Three guides exist, all in `editorial-review` and therefore `noindex` — the gate holding them back is working. The article ideas A lists are all tied to real transactions and local specifics, and all need real editorial work plus legal/financial review for the statutory ones.

## §10 — Scalable SEO only after proving quality

**Decision: Gate implemented; one threshold consciously calibrated differently.**

A's minimum rules for a generated page — ≥5 active listings, unique market statistics, unique nearby landmarks and commute data, an original summary, internal links, human review before indexing, and `noindex` when unmet — describe the quality gate built in files 3 and 5 almost exactly. `evaluatePageQuality()` checks approval, canonical, parent link, distinct data, methodology, source/update metadata and a per-kind evidence bar; `getPublishableSeoPages()` keeps failures out of the sitemap.

**One deliberate difference: the locality threshold is ≥1 live listing plus distinct data, not ≥5.** Applying A's ≥5 rule to locality pages would drop exactly the **six hand-authored Ahmedabad localities**, which have one listing each — and which are the *only* localities with landmark data, the richest editorial notes, and the edge cases behavioural tests rely on. A rule that removes the best pages to protect against the worst is calibrated backwards. The strict bar (≥6, or a verified transaction, or ≥300 words) is preserved for the `programmatic` kind, which is where A's generated pages would land.

## §11 — Track business outcomes by query group

**Decision: Partly implemented; analytics gated.**

`client/src/lib/seo/monitoring.ts` covers the Search Console side — indexed-vs-submitted ratio, coverage and click-drop thresholds, and a setup checklist. Per-query-group reporting, rich-result monitoring and the analytics conversions A lists (qualified calls, WhatsApp clicks, viewing requests, saved properties, calculator completions, leads per 1,000 organic visits) need live GSC and GA4 accounts.

The framing is adopted: rankings alone are not the goal. The round-11 register already measures indexed *valuable* pages rather than total indexed pages.

---

## What shipped in this pass

| Change | File(s) |
|---|---|
| Per-asset intrinsic image dimensions replacing the single 1.5 ratio | `client/src/components/architech/Pic.tsx` |
| Tests asserting declared dimensions against the real image files | `client/src/components/architech/pic.test.ts` (new) |

## Verification

```
pnpm check    clean
pnpm lint     clean
pnpm test     634 passed (76 files) — was 631 before this pass
pnpm build    clean
```

Rendered-HTML checks:

- hero `width="1376" height="768"` (was 917)
- `prop-courtyard` `width="1200" height="896"` (was 800)
- `brick-arch` `width="896" height="1200"` (was 597 — portrait was declared landscape)
- `srcset` and `sizes` intact on the hero `<source>`

Click-depth BFS: city hubs 1, localities 2, 259/336 listings 3, 64 listings 4.

## What remains pending

1. **Landmark data for 60 of 72 localities** — the largest gap against §3.
2. **12-month price-trend series**, recent registered transactions.
3. **Locality pros/cons, FAQs, named authors.**
4. **Visible report-inaccuracy path** — needs public write surface with abuse protection.
5. **Original photography and video** — including replacing the stock city hero.
6. **ImageObject schema**, `Person` schema.
7. **GSC + GA4 accounts** for query-group and conversion tracking.
8. **Local authority relationships and quarterly price reports.**

## Status

**File 6 of 11 — complete.** One Core Web Vitals bug fixed at the root, with a test that prevents the stale-assumption class of failure from recurring. Everything else verified, measured, or recorded as a gate.

Next in queue: `docs/seo/7 studyarena-round12-contestant-b.md`.

## References

[1]: https://developers.google.com/search/docs/appearance/core-web-vitals "Google Search Central: Core Web Vitals"
[2]: https://web.dev/articles/optimize-cls "web.dev: Optimize Cumulative Layout Shift"
[3]: https://developers.google.com/search/docs/appearance/structured-data/article "Google Search Central: Article structured data"
[4]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Google Search Central: Build and submit a sitemap"
