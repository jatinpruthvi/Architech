# Architech Requirements Registry

This document contains stable requirement IDs. A requirement is normative only when its status is `approved` and it is referenced by `final-three-phase-architecture.md` or an approved contract.

## Requirement format

Each requirement has an ID, status, owner, source, implementation location, acceptance evidence, and reversal trigger. A future change must preserve the ID and record a superseding decision rather than silently changing behavior.

## Product and UX requirements

| ID | Requirement | Status | Owner | Acceptance evidence |
|---|---|---|---|---|
| UX-001 | Public pages expose primary facts without requiring JavaScript, WebGL, LLM output, or map interaction. | approved | Product + SEO | Raw HTML and JavaScript-disabled browser test. |
| UX-002 | Motion is real, intentional, responsive, and has reduced-motion, no-WebGL, no-video, and low-data fallbacks. | approved | Design + Frontend | Visual regression, accessibility, and device performance tests. |
| UX-003 | Public SEO pages use server-first rendering; authenticated application routes may be client-rich. | approved | Frontend + SEO | Route-group rendering audit. |
| UX-004 | English and Hindi/Devanagari foundations exist before public language expansion. | approved | Product + Localization | Font, dictionary, alias, layout, and metadata tests. |
| UX-005 | Public page links use real `<a href>` elements with descriptive anchor text. | approved | Frontend + SEO | Crawlable-link test. |

## Data and domain requirements

| ID | Requirement | Status | Owner | Acceptance evidence |
|---|---|---|---|---|
| DOM-001 | Listings have stable IDs, version history, lifecycle status, source provenance, and meaningful-edit timestamps. | approved | Backend + Data | Schema, migration, fixture, and lifecycle tests. |
| DOM-002 | Broker organizations, roles, verification, media rights, and audit events are represented explicitly. | approved | Backend + Operations | Contract and permission tests. |
| DOM-003 | RERA records store source, retrieval time, parser version, confidence, evidence, and correction status. | approved | Data + Legal | Provenance fixtures and legal gate. |
| DOM-004 | Leads support masked contact by default and consented direct contact as an explicit audited mode. | approved | Product + Backend | Lead contract and privacy tests. |
| DOM-005 | Media assets store ownership/license evidence, moderation status, derivatives, retention, and takedown data. | approved | Media + Legal | Upload, moderation, and deletion tests. |

## Google SEO requirements

| ID | Requirement | Status | Owner | Acceptance evidence |
|---|---|---|---|---|
| SEO-001 | Canonical URL generation is centralized and reused by routes, metadata, JSON-LD, redirects, sitemaps, and audits. | approved | SEO + Backend | Canonical consistency test. |
| SEO-002 | Every indexable page has one primary intent, owner, quality state, evidence status, and freshness policy. | approved | SEO + Content | `SeoPage` registry audit. |
| SEO-003 | Arbitrary facet combinations do not become indexable pages without passing qualified-intent gates. | approved | SEO + Search | URL policy and indexability tests. |
| SEO-004 | Listing lifecycle transitions produce correct 200, 301, 404, or 410 behavior. | approved | Backend + SEO | Lifecycle integration tests. |
| SEO-005 | Sitemap partitions contain canonical, indexable, permitted URLs and meaningful `lastmod`. | approved | SEO + Platform | Sitemap validator and sampled crawl. |
| SEO-006 | Metadata and JSON-LD are generated from the same entity snapshot as visible facts. | approved | SEO + Backend | Snapshot drift tests. |
| SEO-007 | Google Search Console is the primary search monitoring system. Bing and IndexNow are optional provider adapters. | approved | SEO + Platform | API ingestion health and alert test. |
| SEO-008 | Phase 1 begins legitimate off-page authority work without paid ranking-passing links or manipulative exchanges. | approved | Growth + Legal | Asset registry, outreach log, disclosure review, and referral report. |

## Security, privacy, and legal requirements

| ID | Requirement | Status | Owner | Acceptance evidence |
|---|---|---|---|---|
| SEC-001 | Authentication supports secure sessions, roles, 2FA, passkeys, recovery, audit events, and rate limits. | approved | Security + Backend | Auth/security test suite. |
| SEC-002 | Public and private data are separated by authorization, cache boundaries, and output contracts. | approved | Security + Platform | Cache isolation and authorization tests. |
| SEC-003 | Uploads use signed authorization, MIME/size validation, malware scanning, EXIF removal, moderation, and retention rules. | approved | Security + Media | Upload abuse and lifecycle tests. |
| LEG-001 | RERA, public-record, personal-data, media-rights, email, sponsored-link, and commercial-lead gates pass before release. | approved | Legal + Product | Signed approval record per gate. |

## Performance and reliability requirements

| ID | Requirement | Status | Owner | Acceptance evidence |
|---|---|---|---|---|
| PERF-001 | Report Core Web Vitals from field RUM and lab tests by route class and device/network class. | approved | Frontend + SRE | Dashboard and release report. |
| PERF-002 | Public JavaScript budgets are measured separately from authenticated application budgets. | approved | Frontend | Bundle report and CI threshold. |
| PERF-003 | Map rendering is benchmarked on desktop and Redmi Note-class Android with CPU throttling and 4G/poor-network profiles. | approved | Maps + QA | Benchmark artifact and fallback test. |
| PERF-004 | API latency budgets are defined per endpoint class and tested under representative inventory. | approved | Backend + SRE | Load-test report. |
| REL-001 | Availability, RPO, RTO, backup retention, restore drills, and incident response are measured. | approved | SRE + Security | Quarterly restore and incident exercise. |
| COST-001 | Storage, media processing, email, jobs, database, search, and AI costs have owners, budgets, and alerts. | approved | Platform + Finance | Monthly cost report and alert test. |

## Phase status vocabulary

```text
planned → contracted → implemented → validated → enabled → retired
```

A feature must not be publicly enabled while it is merely planned or contracted. A feature can be implemented but disabled while benchmarks, legal approval, editorial review, or operational readiness are incomplete.
