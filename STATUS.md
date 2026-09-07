# Architech implementation status

**Current revision:** `a77e526` plus the repository-audit hardening and Amdavad Modern UX revision in the active workspace.  
**Product:** India-wide, Google-first real-estate discovery platform (12 live cities, 72 localities).  
**Implementation mode:** Next.js 16 App Router reference implementation with fixture adapters available for local preview.

## Current gates

| Gate | State | Evidence or next action |
|---|---|---|
| TypeScript | Passing after the authorization migration | Run `pnpm check`. |
| ESLint | Passing after the unused-import cleanup | Run `pnpm lint`. |
| Unit contracts | Focused auth, workflow, persistence, and API suites passing | Run `pnpm test`. |
| Production build | Passing | `NODE_ENV=production pnpm build:ci` completed with static/SSG/dynamic route output. |
| Live authentication | Not activated | Configure Better Auth URL, secret, database, and live cookie/session adapter. |
| Durable data | Not activated by default | Set Prisma and provider source modes only after migrations and readiness checks. |
| Public indexing | Explicitly gated | Set `PUBLIC_INDEXING_ENABLED=true` only after data, source, legal, and SEO gates pass; rendered-HTML smoke passed with the gate off. |
| External providers | Pending | R2, Gujarat RERA, Sentry, Search Console, email, and legal approvals require real accounts/secrets. |
| AI crawler policy | Shipped, deliberate | `robots.txt` now carries per-bot rules: search/grounding crawlers (OAI-SearchBot, PerplexityBot, Google-Extended) follow the indexing gate; training crawlers (GPTBot, ClaudeBot, CCBot, …) are disallowed pending LEG-003/LEG-008. Override with `ARCHITECH_AI_CRAWLER_POLICY`. |
| AI index files | `/llms.txt` shipped, `/llms-full.txt` gated off | The index is derived from the publishable registry, as the supplemental-only file the architecture permits. The full-text corpus needs `ARCHITECH_LLMS_FULL_ENABLED` **and** public indexing, and stays closed until inventory is verified. Evidence: [`docs/seo/ai-visibility-surfaces-2026-09-07.md`](docs/seo/ai-visibility-surfaces-2026-09-07.md). |
| Image sitemap | Shipped | `/sitemap/images.xml` advertises listing photography for publishable dossiers only, absolute URLs, de-duplicated. Video remains unimplemented — no assets exist. |
| SQL search path | Verified against a live cluster, still opt-in | 48/48 parity scenarios pass and the page path is ~7x faster than the JS fallback (p50 27.8 ms vs 266.6 ms). Enable with `ARCHITECH_SEARCH_SQL_PAGE=on` where the search migrations are applied. Evidence: [`docs/search/search-activation-and-relevance-2026-09-07.md`](docs/search/search-activation-and-relevance-2026-09-07.md). |

## Implemented hardening

Private broker, admin, moderation, authority, media, RERA-correction, and saved-search routes now use the centralized server-only authorization guard. The guard rejects anonymous or unconfigured live-auth requests, blocks demo authentication in production, checks declared permissions, and applies mutation body-size, origin, and burst controls. Broker workflow mutations receive the authenticated session so organization ownership checks work in memory as well as in persistence adapters.

Sitemap and robots generation now stop advertising public pages until the explicit production indexability flag is enabled. A Next.js proxy adds `X-Robots-Tag: noindex, nofollow` as a final production safety net. Rendered-HTML SEO smoke coverage now includes guide, search-noindex, privacy, and terms route families and passes for 9 routes. The repository also contains a GitHub Actions quality workflow for frozen dependency installation, checks, tests, Prisma validation, and build.

The current UX revision adds a stronger geometric A mark with a terracotta doorway notch, atlas-grid map surfaces with coordinate annotations, a search-page Atlas Lens evidence band, partner-facing broker language, dynamic boundaries for client-only authenticated surfaces, and a bounded Reveal fallback so inventory cannot remain invisible when an observer does not fire. Desktop and mobile visual QA covered the home, search, locality, listing, and broker dashboard routes.

## India-wide coverage (August 2026 revision)

The platform is no longer Ahmedabad-only. A city registry (`client/src/lib/cities.ts`) is now the top of the place hierarchy, localities are keyed to a city, and the public route grammar is `/buy/` → `/buy/{city}/` → `/buy/{city}/{locality}/`. Twelve cities across ten states are live; `/buy/ahmedabad/...` URLs are unchanged, so no redirects were required and existing canonicals, sitemap entries, and Search Console history stay valid.

Registry-driven surfaces: locality/city routes and `generateStaticParams`, the `SeoPage` registry and sitemap partitions, city and locality JSON-LD (including state and RERA authority), the search city scope (`?city=`), the home city index, related-listing selection, broker onboarding and listing-draft validation, requirement capture, and the Prisma seed (via a generated registry mirror with a drift test).

Ahmedabad retains hand-authored editorial fixtures; other cities use deterministic generated demo inventory derived from a city price band and locality price index. All of it remains illustrative demo data.

Places are also **PIN-code addressable**. Cities carry their three-digit India Post sorting-district prefixes and localities carry the PIN codes they serve, both as lists because the relationship is many-to-many in both directions. `client/src/lib/pincodes.ts` resolves a PIN to localities, falls back to the city that owns the district when no locality claims it, and returns `null` rather than guessing. PIN codes never appear in canonical URLs; they are exposed as `?pincode=` on search, as a recognised six-digit token in `?q=`, as a visible fact on locality pages, and as `postalCode` in `PostalAddress` JSON-LD. Schema support lands in migration `202608270001_pincode_registry` (`Locality.pincodes` GIN-indexed, `City.pincodePrefixes`, `Listing.postalCode`). The PIN data itself is illustrative demo data pending India Post verification.


**Full-text search now indexes what Indian queries actually contain.** The generated `Listing.searchVector` was built with the `english` configuration alone, which erases English stopwords that are real place-name components (`to_tsvector('english','Do Talao')` drops "Do"), cannot match `Paldi` against `pāldi`, and — because `titleHi`/`descriptionHi` were never in the vector — matched no Devanagari at all. Migration `202609070001_search_text_config` indexes every field under **both** `english` (stemming, so "garden" still finds "Gardens") and a new `architech_simple` configuration (`simple` + `unaccent`), because replacing one with the other loses recall in the opposite direction. Measured on a live cluster: three previously zero-result queries recovered, no regressions, A/B/C/D weights preserved. A **relevance sort** (`ts_rank_cd` in SQL, a term-frequency-weighted mirror in JS) is now offered whenever query text exists, so results can be ordered by match quality rather than edit date.

The **search box understands queries** rather than passing them through. A deterministic grammar (`client/src/lib/search/parse-query.ts`) extracts BHK, budget, intent, category, filters, city, locality and PIN from free text, maps them onto real URL parameters, and keeps anything unrepresentable as free text so the rewrite is lossless. Suggestions are ranked (exact → prefix → word-prefix → substring → bounded typo correction) with an active-city boost, PIN lookups, and structured "search with these filters" actions. Popular, trending and placeholder examples are derived from live inventory with real counts; recent searches are stored per-device in `localStorage`. This replaced hardcoded Ahmedabad-only suggestion literals and a `String.includes` matcher.
## Source-of-truth order

Read [`README.md`](README.md), [`architecture/normative/final-three-phase-architecture.md`](architecture/normative/final-three-phase-architecture.md), [`governance/contracts/DOMAIN-CONTRACTS.md`](governance/contracts/DOMAIN-CONTRACTS.md), [`PHASE-1-IMPLEMENTATION-PLAN.md`](PHASE-1-IMPLEMENTATION-PLAN.md), and [`docs/runtime-activation-gates.md`](docs/runtime-activation-gates.md). Historical improvement reviews describe earlier repository states and should not override the current application or normative contracts.
