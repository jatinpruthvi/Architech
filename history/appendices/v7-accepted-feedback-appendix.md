

---

# Recommendation v7 — Accepted Feedback Integration

This appendix is authoritative wherever it refines v6. All v6 capabilities remain mandatory.

## 1. Version and framework policy

Use **Next.js 16.3 or the latest stable 16.x patch available at implementation time**, pinned exactly in `package.json` and the lockfile. Official documentation identifies Next.js 16.3 as released on August 3, 2026.[12] Do not use a canary release in production. Before implementation, record the selected version, release-note review, Cache Components verification, `proxy.ts` verification, React compatibility, deployment adapter compatibility, and tested rollback version.

Use `proxy.ts` for the selected Next.js 16.x request boundary after an integration test confirms the exact API. Restrict it to security headers, host/locale normalization, redirects, authentication presence checks, and lightweight bot/request policy. Do not put database access or heavy business logic in it.

## 2. React Compiler gate

React Compiler remains opt-in. Enable it only when the following gates pass against the same commit without the compiler: hydration and search/filter interaction regression no worse than 10%; no unexplained route-bundle growth; no material memory increase; acceptable documented build-time increase; all Vitest, Playwright, accessibility, SEO, visual, map, and WebGL tests passing. If any gate fails, leave it disabled and re-evaluate after upgrades.

## 3. Icon policy

**Lucide React is the primary icon system** for the application, search, maps, listings, broker dashboard, and accessibility-sensitive surfaces. Phosphor is permitted only for an approved marketing/hero art direction. Engineers must not select icon families independently.

## 4. Hybrid natural-language search parser

The parser is deterministic first and LLM-assisted only for ambiguity:

```text
normalize Unicode/transliteration
→ parse transaction words, Indian prices, BHK, area, property type,
  furnishing, amenities, city/locality aliases, and radius
→ validate candidate filters with Zod
→ execute structured search when confidence is sufficient
→ call LLM fallback only for zero-result or ambiguous input
→ validate every LLM ID/value/bound against allowed data
→ show interpreted filters to the user
→ execute database/search-provider query
```

The rules must handle examples such as `2bhk`, `2 BHK`, `2-bedroom`, `50L`, `1.5 crore`, `2cr`, `under 2cr`, `rent`, `buy`, `near Bandra station`, `within 2km`, and furnishing terms. The locality dictionary stores canonical names, aliases, transliterations, and city/state relationships.

The LLM may suggest filters but must never invent listing facts, prices, availability, RERA status, broker identity, or project information. Its output is a Zod-validated typed object with transaction type, city/localities, property type, BHK, price bounds, area, amenities, radius, confidence, and ambiguities. The system works if the LLM is unavailable.

## 5. Map benchmark protocol

Replace universal FPS claims with an attached measured report. Use production-shaped datasets at 1,000, 5,000, 10,000, and 25,000 points; test Scatterplot, Icon, Heatmap, ScreenGrid, clusters, selection, viewport changes, and card synchronization; run on a mid-range Redmi Note-class Android phone in Chrome with 4x CPU throttling and representative 4G throttling; repeat on desktop and low-end Android. Record median/p95 frame time, dropped frames, long tasks, memory, bytes, time to first usable map, pan/zoom/filter/selection latency, and cold/warm behavior. Reduce layer complexity or sampling when budgets fail. The list-first fallback is mandatory.

## 6. Graceful optional fields

Listing initial HTML requires only the facts available: title, price or price status, locality/city, property type, and broker/source identity. BHK, area, furnishing, availability, amenities, RERA, video, coordinates, and possession appear only when present and permitted. Missing values are hidden; never render `null`, `undefined`, blank labels, or misleading `N/A`. The same rule applies to cards, metadata, JSON-LD, filters, and analytics.

## 7. Storybook scope

Storybook covers design-system primitives, compound components, token variants, and the complete result-card state matrix: normal, video, RERA verified, saved, compare-selected, loading, error, hover, keyboard focus, and reduced motion. It also covers search/filter controls, gallery, map/list controls, lead form, upload dropzone, media states, and broker form states. Full pages use Playwright and visual regression instead of requiring stories for every route.

## 8. Database operations

Use **PgBouncer transaction pooling** for serverless-to-PostgreSQL where supported, or select Prisma Accelerate after an explicit compatibility/cost/observability review. Choose one production path before launch. Configure bounded pool size, connection/statement/idle timeouts, migration connection handling, burst tests, and pool-exhaustion alerts. Reuse Prisma clients and never create unbounded pools per invocation.

Backups: production hourly target where supported, daily minimum, encrypted storage, at least 30-day retention, pre-migration snapshot where required, and a quarterly isolated restore drill with measured RPO/RTO and application smoke tests. A backup is valid only after successful restoration.

Prisma production schema changes use committed migration files and `prisma migrate deploy` in CI/CD. `prisma db push` is development-only and forbidden in production. Use expand/migrate/contract for destructive or rolling-deployment changes.

## 9. Lead system decision

The first-phase business model is **masked contact with broker notification and analytics**. Direct contact reveal and pay-per-lead billing remain future extensions.

```text
contact broker
→ consent/purpose notice
→ minimum contact collection
→ phone/email validation
→ idempotent Lead creation
→ spam/rate/risk checks
→ route to broker organization
→ notify broker
→ show user confirmation/reference
→ track delivery/view/contact/qualification state
```

The Lead entity contains: id, public reference, listing/project/broker IDs, user or anonymous token, contact name/email/phone, preferred method, message, source page/type, attribution, consent and privacy-notice versions/timestamps, status, risk score, dedupe key, notification statuses, timestamps, retention deadline, and deletion timestamp. PII is encrypted/tokenized as designed and excluded from logs. Apply per-user, IP, broker, device, and endpoint abuse controls.

## 10. Email and notification provider

Use **Resend + React Email** for transactional email behind an `EmailProvider` interface. Required templates include verification, broker invitation, passkey/security events, lead notification, lead confirmation, saved-search alerts, moderation result, RERA updates, recovery, and operational alerts. Store provider message ID, delivery state, retry state, template version, and redacted error reason. Jobs are idempotent. Postmark remains a provider replacement option.

## 11. Content moderation

Listing descriptions are plain text by default. If controlled rich text is later permitted, use server-side DOMPurify with a strict allowlist. Normalize text, enforce length limits, strip or approve URLs, detect spam/phishing/competitor promotion/discriminatory or unverifiable claims, validate state-specific RERA formats, and route first-time broker submissions to moderation. Store reviewer decisions and edit diffs. Never allow arbitrary broker HTML or scripts.

## 12. Privacy and DPDP posture

The system processes account, broker, saved-search, alert, lead, analytics, and location data. Add notice and purpose limitation, lawful processing/consent records, withdrawal, access/correction/deletion workflow, processor inventory, retention schedules, child safeguards, encryption, role boundaries, breach response, and PII redaction. India counsel must review the Digital Personal Data Protection Act, 2023 posture.[13] GDPR review is required if EU users are targeted or monitored in a way that creates GDPR scope. Default retention is minimum necessary; lead PII is deleted or anonymized after its documented business/legal period.

## 13. Search Console and Bing API sync

Add nightly Trigger.dev jobs. The Google job pulls Search Analytics, verified sites, sitemap data, and permitted coverage/inspection information through the Search Console API.[14] The Bing job uses current Webmaster REST APIs for rank/traffic, links, keywords, crawl, sitemap, and submission data where permitted. Do not use legacy Bing SOAP/POX APIs; Microsoft documents their retirement on August 31, 2026.[15] Store normalized time series by page cluster, query, device, country, sitemap, and crawl state, with retries, credentials isolation, redaction, and alerting.

## 14. Subdomain takeover prevention

Maintain a registry of subdomain, DNS record, owner, cloud resource, environment, certificate, purpose, verification date, and retirement status. Before removing a cloud resource, remove DNS CNAME/A/ALIAS records first, verify propagation, then remove the resource and credentials. Run scheduled checks for dangling CNAMEs, abandoned targets, unknown subdomains, and certificate issues. HSTS does not prevent takeover by itself.

## 15. Lenis route groups

```text
app/(marketing)/  → home, static guides, about, methodology
app/(app)/        → buy, rent, results, listings, projects, broker, saved, compare, dashboard
```

Lenis exists only in `(marketing)` after keyboard, focus, touch, anchor, history, reduced-motion, and screen-reader tests. It is absent from application routes, which use native scrolling and measured Motion/GSAP interactions.

## 16. India-specific performance budgets

| Class | LCP target | Behavior |
|---|---:|---|
| Desktop, fast connection | ≤ 2.5s | Full approved motion. |
| Mid-range mobile, 4G | ≤ 3.5s | Adaptive media and reduced heavy effects. |
| Mobile, 3G/poor network | ≤ 4.5s | Reduced motion, poster-first video, low-data images, list-first map. |

Report p75 field values where traffic permits and lab results on fixed devices. Track INP, CLS, TTFB, long tasks, JavaScript bytes, and media bytes with LCP. These are engineering targets, not ranking guarantees.

## 17. Corrected first-phase dependency sequence

All capabilities remain first-phase scope. Sitemaps/freshness precede internal graph monitoring, and leads receive a dedicated workstream:

```text
1 framework/version
2 design system/Storybook
3 domain and data model
4 database/pooler/backups/migrations
5 auth/security/privacy
6 page authority and URL policy
7 search and hybrid parser
8 public pages
9 sitemaps/freshness/Search Console/Bing foundation
10 internal graph/orphan monitoring
11 results/maps/benchmark
12 media pipeline
13 detail/conversion
14 lead system/email/analytics
15 broker operations/moderation
16 premium motion/route groups
17 RERA/jobs/embeddings/citation monitoring
18 observability/privacy dashboards
19 full testing/release gates
```

## 18. Added release gates

Block release if the exact stable framework and `proxy.ts` behavior are not verified; React Compiler fails its numeric gate; the selected pooler fails burst tests; backup/restore evidence is missing; lead consent/routing/deduplication/notification tests fail; descriptions can inject HTML or unvalidated claims; Search Console/Bing sync is not authenticated and retry-safe; dangling DNS exists; `prisma migrate deploy` is not used; LCP is evaluated with one universal number only; the map lacks a device/throttle report; or Lenis appears outside marketing routes.

## 19. Final v7 contract

```yaml
preserve_v6_capabilities: true
framework: Next.js 16.3 or latest stable 16.x patch
search: PostgreSQL FTS + pg_trgm + PostGIS + pgvector behind ListingSearchProvider
parser: deterministic rules first; LLM fallback for ambiguity/zero results
pooling: PgBouncer transaction mode or explicitly selected compatible alternative
lead_model: masked contact
email: Resend + React Email behind provider interface
icons: Lucide primary; Phosphor marketing exception only
lenis: app/(marketing) only
seo_data: Search Console API + Bing Webmaster REST API nightly sync
privacy: DPDP Act posture with legal review
migration: prisma migrate deploy; never db push in production
preserve_motion: GSAP + ScrollTrigger + Motion + CSS scroll-driven + optional Lenis/R3F
fallbacks: reduced motion, no WebGL, poster-first video, list-first map, structured search without LLM
```

## References for v7 updates

[12]: https://nextjs.org/blog/next-16-3 "Next.js 16.3 release announcement, August 3, 2026"
[13]: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8f35e82c42aa5.pdf "Digital Personal Data Protection Act, 2023"
[14]: https://developers.google.com/webmaster-tools "Google Search Console API"
[15]: https://learn.microsoft.com/en-us/bingwebmaster/ "Bing Webmaster API and REST migration notice"

# Final v7 statement

Recommendation v7 preserves the complete v6 technology, UI, motion, map, media, RERA, broker, page-authority, SEO, AI-search, security, and first-phase scope. It accepts the feedback by adding exact implementation contracts for version pinning, compiler and map benchmarks, database operations, the masked-contact lead system, notifications, moderation, privacy, API-based SEO monitoring, DNS hygiene, migrations, route groups, and India-specific performance.
