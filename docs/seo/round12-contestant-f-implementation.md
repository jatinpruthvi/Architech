# StudyArena round 12 — contestant F: implementation record

**Source:** `docs/seo/11 studyarena-round12-contestant-f.md`
**Branch:** `arena/01a04d70-architech`
**Scope:** F gives five moves ranked by impact-to-effort, plus a "what not to
bother with" list and an 18-month timeline. This pass audits each against the
code, implements what is real, and records where a recommendation was
deliberately not taken.

This is the last file in the sequence. Most of what F asks for was already
built by files 1–10; what remained was one genuinely broken mechanism and one
incomplete schema node.

---

## F's thesis

> Housing.com is a mile wide and an inch deep on every micro-locality. Be an
> inch wide and a mile deep.

Concretely: hyperlocal long-tail (§1), Google Business Profile (§2), YMYL
trust signals (§3), technical SEO (§4), and content portals won't make (§5).

---

## §1 Hyperlocal long-tail — one mechanism was broken

F's example queries are shapes like *"2 bhk for rent in [building /
micro-locality]"*. The site has always accepted those as URL slugs, through
two catch-all routes. Both were answering them by matching literals in the
joined string:

| Route | What it did | Consequence |
| --- | --- | --- |
| `/property/[...segments]` | `raw.includes("gandhinagar") ? "gandhinagar" : "ahmedabad"` | **Any slug that is not Gandhinagar became an Ahmedabad search.** `/property/2bhk-rent-bandra-west` → Mumbai query served as Ahmedabad. |
| `/property-search/[...slug]` | A hardcoded list of ten Ahmedabad localities | A slug naming any of the other 62 localities produced an **empty query**. |

Two routes, two copies of the same idea, already drifting, both frozen at the
point where the site was Ahmedabad-only. The site grew to 12 cities and 72
localities; the literal matching did not.

**Fixed.** Both routes now call one resolver, `keywordSlugToSearchUrl`, which
routes through `parseSearchQuery` — the parser the search box already uses.
It reads BHK, budget, intent, category, PIN codes and place names against the
live registry, so nothing needs maintaining twice. A test asserts a slug and
the same words typed into the search box produce the *same* URL.

*Measured:* `2bhk-rent-bandra-west` → `city=mumbai` (was Ahmedabad);
`rent-whitefield` → `city=bengaluru` (was Ahmedabad). All 72 localities now
resolve to their own city.

**Also fixed: permanence.** F §4 asks for a 301 strategy for duplicate and
legacy URLs. Both routes used `redirect()` (307, temporary) for what is a
permanent alias. They now use `permanentRedirect()` (308), so crawlers and
browsers collapse the alias onto the canonical search URL instead of
re-following it forever.

An unrecognised place is **not** guessed into a city. It goes to the open
search — a confident wrong result set is worse than an empty one.

**Not built: building/society pages.** F wants one page per building with
floor plans, RERA status and commute times. There is no `Project` model in
`prisma/schema.prisma`; this has been deferred since file 8 and stays
deferred. 72 locality pages carry the hyperlocal load in the meantime.

**Named gap: no rent surface.** `cityUrl()`/`localityUrl()` accept an
`intent` of `"rent"`, but nothing passes it and there is no `app/rent/` route
tree. F's rent queries therefore resolve to search (correctly filtered, but a
noindex surface) rather than to an indexable page. Building a parallel rent
route tree is a new product surface, not an SEO fix; it is recorded here
rather than silently skipped.

## §2 Google Business Profile — operational

Claiming, categories, photos, weekly posts, keyword-rich review requests.
Nothing to build and nothing in the repo contradicts it.

## §3 YMYL trust — the schema node was incomplete, and one field must stay empty

F: real estate is "Your Money or Your Life"; Google applies extra trust
scrutiny, so publish real identity — address, phone, RERA credentials, team
pages, and mark it up.

**What changed.** The `Organization` node in the root layout carried only
name, url, logo and areaServed — the thinnest possible form. It now also
carries `address`, `geo` and `contactPoint`, and is emitted on every route
via the root layout. The values come from facts `/contact-us/` already
publishes: "Ahmedabad, Gujarat · 23.03° N · 72.58° E".

**What was deliberately left out, and why it matters more than what was
added.** The contact page states that the phone and email channels are
*pending activation*. Marking up a `telephone` anyway would be the exact
fabricated trust signal the YMYL scrutiny exists to catch — and it would
contradict a page the user can read. So:

- `telephone`, `email`, `streetAddress`, `postalCode` — **omitted**.
- `contactPoint` carries only what is true: support exists, in India, in
  English and Hindi.
- `sameAs` — **omitted.** Deferred in file 8 because the social profiles are
  not claimed; asserting them would claim an identity not established.

`organization.test.ts` pins both: the address and coordinates are asserted
present, and the serialised node is asserted **not** to contain a telephone,
email, street address or postcode. *This guard was verified non-vacuous* — it
fires on a node carrying either field. When the channels go live, that
assertion is deleted in the same commit that adds the real number.

Also absent and not invented: team photos, RERA registration numbers, and
years of experience. F asks for all three. Publishing placeholder
credentials on a YMYL site is worse than publishing none.

## §4 Technical — mostly built; two gaps closed

| F asks | State |
| --- | --- |
| Core Web Vitals, lazy loading, next-gen formats, lean JS | **Done.** 3716/3716 images in `<picture>` with WebP `srcSet`, all with intrinsic dimensions; LCP image eager + high priority (file 9). |
| `RealEstateListing` | On listing pages. |
| `BreadcrumbList` | 425/436 content routes (file 9) + all 13 price-index routes (file 10). |
| `Organization` | **Completed this pass** — see §3. |
| `LocalBusiness` | Not applicable: no customer-facing premises. |
| `FAQPage` | Withheld — Google restricted FAQ rich results to government and health sites in 2023. |
| `aggregateRating` | Correctly absent, and F agrees it should be unless reviews are genuine. |
| Clean keyword URLs | **Fixed this pass** — see §1. |
| Sitemap + robots.txt | `robots.ts` is environment-gated (`isPublicIndexingEnabled()`), disallows `/search/` and `/saved/`, and points at the sitemap index. Seven child sitemaps. |
| Canonical on every page | Enforced by the smoke suite. |
| 301 strategy for duplicates | **Fixed this pass** — keyword aliases are now permanent redirects. |
| Server-rendered listings | Every public route prerenders. |

## §5 Content portals won't make — largely built

- **Neighbourhood guides with original research** — commute and amenity
  distances are on every locality page (`CommuteStop[]`, real distances);
  price trends are on the locality page and now also published as the
  per-city index (file 10).
- **Rental yield tables** — `grossYieldPct` (gross rental yield / GRM) in
  `investment/metrics.ts`, on `/investment/`.
- **"How to check RERA status"** — `/guide/rera/gujarat/how-we-verify-rera/`.
- **"Home loan eligibility [city]"** — `/home-loan/` EMI calculator.
- **"Stamp duty calculator [city]"** — `OwnershipCost` (stamp duty,
  registration) renders on every listing page. Not a standalone per-city
  tool; that would be a new tool, not a gap.
- **Original data → links** — the price index (file 10).

Not built, because there is no data source: school catchment maps, crime
data, and future-infrastructure projects. Inventing them would violate the
no-invented-facts rule that the price index's own gate depends on.

## What NOT to bother with — already the house position

F warns against chasing head terms, buying links, and copying listing
descriptions. All three match the decision register and the spam-policy
notes; nothing to change.

---

## What changed

**New**

| File | Purpose |
| --- | --- |
| `client/src/lib/search/keyword-slug.ts` | One resolver for keyword URLs, built on `parseSearchQuery`. |
| `client/src/lib/seo/organization.ts` | The `Organization` node, with the address and coordinates the site already publishes. |

**Changed**

| File | Change |
| --- | --- |
| `app/property/[...segments]/page.tsx` | Was: two hardcoded city names, everything defaulting to Ahmedabad. Now: registry-backed resolution, permanent redirect. |
| `app/property-search/[...slug]/page.tsx` | Was: ten hardcoded localities. Now: the same resolver, permanent redirect. |
| `app/layout.tsx` | `Organization` node from the new module. |
| `scripts/seo/raw-html-smoke.mjs` | Five assertions on the keyword routes: permanence, correct city, no guessed city. |

**Tests** — `keyword-slug.test.ts` (9), `organization.test.ts` (7).

---

## Verification

```
pnpm check     clean
pnpm lint      clean
pnpm test      765 passed / 85 files   (was 749 / 83)
pnpm test:seo  17 routes, 7 sitemaps, 5 keyword-slug checks
```

| Before | After |
| --- | --- |
| `2bhk-rent-bandra-west` → Ahmedabad | → `city=mumbai&intent=rent&filters=2bhk` |
| `rent-whitefield` → Ahmedabad | → `city=bengaluru&intent=rent` |
| Unrecognised locality → empty query | → open search, no city guessed |
| Keyword aliases redirected 307 (temporary) | **308 (permanent)** |
| `Organization`: name, url, logo, areaServed | + `address`, `geo`, `contactPoint`, `description` |

Both new guards were checked for vacuity: the telephone/email assertion fires
on a node carrying either field, and the smoke assertions fail on a 307 or on
a wrong `city=`.

---

## Deliberately deferred

- **Building/society pages** — no `Project` model (deferred since file 8).
- **A rent surface** (`/rent/[city]/[locality]`) — a new product surface, not
  an SEO fix. Named here so it is a decision, not an oversight.
- **GBP, review generation, citations** — operational.
- **Team photos, RERA registration numbers, years of experience** — not
  available; placeholders on a YMYL site are worse than absence.
- **Phone/email in schema** — channels pending activation; pinned by a test
  that must be removed in the same commit that adds them.
- **`sameAs`** — profiles not claimed.
- **`FAQPage`, `LocalBusiness`** — restricted since 2023; no premises.
- **School catchment, crime, future infrastructure** — no data source.
- **`verifiedTransactions`** remains 0 (no IGR ingest).

## Note for launch

Public indexing is gated: `robots.ts` disallows everything in production
unless `PUBLIC_INDEXING_ENABLED=true` (`client/src/lib/seo/runtime.ts`). Every
count in this record is a count of pages *ready* to be indexed, not of pages
currently in Google's index.
