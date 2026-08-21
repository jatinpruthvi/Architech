# Architech

## AI-Readable Real-Estate Platform Architecture

Architech is the architecture and implementation-planning repository for a premium India-focused real-estate discovery platform. It defines the product, user experience, technical stack, page-authority model, Google-first SEO system, AI-search readiness, broker operations, RERA verification, media pipeline, security posture, localization strategy, infrastructure, testing, and three-phase delivery plan.

This repository is the **architecture source**, not the application source code. Engineering teams and AI coding systems should use it as the authoritative design reference before implementing production code.

> **Primary objective:** Build the best real-estate discovery experience in India while making every important public page useful, trustworthy, crawlable, indexable, fast, accessible, and understandable to Google and AI systems.

## Table of contents

1. [Current source of truth](#current-source-of-truth)
2. [Project goals](#project-goals)
3. [Core architectural principle](#core-architectural-principle)
4. [Approved technology direction](#approved-technology-direction)
5. [Three-phase execution model](#three-phase-execution-model)
6. [Google-first SEO strategy](#google-first-seo-strategy)
7. [Off-page authority](#off-page-authority)
8. [Information architecture](#information-architecture)
9. [India localization](#india-localization)
10. [Security and privacy baseline](#security-and-privacy-baseline)
11. [Governance and implementation documents](#governance-and-implementation-documents)
12. [How an AI coding system should use this repository](#how-an-ai-coding-system-should-use-this-repository)
13. [Version history](#version-history)
14. [Definition of done](#definition-of-done)

## Current source of truth

Use the following document as the primary implementation reference:

```text
architecture/normative/final-three-phase-architecture.md
```

It combines the complete SEO-integrated architecture with the detailed Phase 1, Phase 2, and Phase 3 execution plan. The document preserves all approved capabilities. Phase boundaries control implementation and activation order; they do not authorize deleting capabilities from the architecture.

The latest Google-first off-page authority strategy is documented separately in:

```text
seo/authority/off-page-authority-google-first-appendix.md
```

The previous archive index is preserved in:

```text
ARCHIVE_INDEX.md
```

### Required reading order

For implementation, read `README.md`, then `governance/feedback/FEEDBACK-REVIEW.md`, `architecture/normative/final-three-phase-architecture.md`, `governance/contracts/REQUIREMENTS.md`, `governance/contracts/DOMAIN-CONTRACTS.md`, `governance/contracts/IMPLEMENTATION-MATRIX.md`, `governance/decisions/DECISION-LOG.md`, and `governance/legal/LEGAL-GATES.md`. Historical version files are for context only and are not independent specifications.

The normative architecture uses stable requirement IDs, decision IDs, contract invariants, work IDs, acceptance evidence, and reversal triggers. A feature can be architecturally anticipated in Phase 1 while remaining disabled until its contract, implementation, validation, legal, cost, or performance gates pass.

## Project goals

Architech is designed to deliver the following outcomes:

| Goal | Required outcome |
|---|---|
| Premium UI | A polished, responsive, accessible interface with clear hierarchy, refined design tokens, excellent mobile behavior, and high-quality loading, empty, error, and success states. |
| Real motion | GSAP, ScrollTrigger, Motion, CSS scroll-driven animation, Lenis on approved marketing routes, and R3F/Drei hero experiences with no-WebGL and reduced-motion fallbacks. |
| Google SEO | A server-first, crawlable, entity-based public website with stable URLs, strong page authority, original content, structured data, sitemaps, freshness, internal links, quality gates, and Google Search Console monitoring. |
| AI readability | Clear entity IDs, provenance, visible facts, source information, timestamps, structured data, accessible text, and citation-ready content. |
| India readiness | INR, Indian property terminology, RERA, localities, city-level search, mobile-first performance, Hindi/Devanagari foundations, transliteration, aliases, and future Indian-language expansion. |
| Marketplace operations | Broker onboarding, organization roles, listing workflows, media upload, moderation, verification, masked-contact leads, notifications, saved searches, and audit history. |
| Trust | RERA evidence, broker verification, source provenance, freshness, privacy, secure authentication, transparent methodology, and responsible content moderation. |
| Scalability | PostgreSQL/PostGIS, Redis, pg_trgm, pgvector, provider-neutral search, background jobs, observability, backups, restore drills, and controlled platform operations. |

## Core architectural principle

The public SEO website and the interactive application use the same canonical domain model but have different responsibilities.

```text
Canonical entity data
  ├── Public SEO layer
  │     ├── server-rendered HTML
  │     ├── metadata and JSON-LD
  │     ├── crawlable links
  │     ├── sitemaps and canonical URLs
  │     ├── page authority and content
  │     └── Google Search Console monitoring
  │
  └── Interactive product layer
        ├── search and filters
        ├── map and list synchronization
        ├── save and compare
        ├── media and video
        ├── broker workflows
        ├── leads and notifications
        └── authenticated dashboards
```

Search engines must not need to operate the application interface to understand the primary facts of a public page. Maps, WebGL, LLM search, semantic search, and rich motion improve discovery and conversion, but they do not gatekeep core content.

## Approved technology direction

| Area | Approved direction |
|---|---|
| Web | Next.js 16 stable security-patched 16.x, React, TypeScript, App Router, Cache Components, `proxy.ts`, Server Components, Suspense, and typed route contracts. |
| Styling | Tailwind CSS v4, CSS custom properties, OKLCH design tokens, responsive composition, dark mode, high contrast, and reduced motion. |
| Components | shadcn/ui, Radix primitives, Lucide icons, Storybook, and custom marketplace components. Phosphor is restricted to approved marketing/hero art. |
| Motion | GSAP, ScrollTrigger, Motion, CSS scroll-driven animation, Lenis on marketing routes, and R3F/Drei for the approved hero experience. |
| Data | PostgreSQL 16+, PostGIS, `pg_trgm`, pgvector, Prisma, Redis 7, PgBouncer or a selected compatible pooler, backups, PITR where available, and restore drills. |
| Search | PostgreSQL full-text search, weighted fields, `pg_trgm`, aliases, PostGIS radius/viewport search, deterministic parsing, cmdk, and an optional typed LLM fallback. |
| Maps | MapLibre, react-map-gl, deck.gl, clustering, selected-marker synchronization, list fallback, and device-specific benchmarks. |
| Media | Cloudflare R2, Cloudflare Stream/HLS, AVIF/WebP derivatives, `srcset`, BlurHash, captions, transcripts, video sitemap, moderation, EXIF removal, and signed uploads. |
| Jobs | Trigger.dev with idempotency, retries, dead-letter handling, run history, safe replay, and alerts. |
| Auth | Better Auth, organizations, roles, sessions, 2FA, magic links, recovery, WebAuthn/passkeys, audit events, secure cookies, CSRF protection, and rate limits. |
| Email | Resend and React Email behind an `EmailProvider` abstraction. |
| Public delivery | Vercel for Next.js delivery, previews, and edge capabilities. |
| Persistent services | Railway as the primary platform for API, workers, scheduled jobs, private networking, and operational environments. |
| SEO | Typed canonical URLs, `SeoPage`, metadata, JSON-LD, breadcrumbs, internal links, sitemaps, freshness, lifecycle states, qualified-intent gates, and Search Console operations. |
| Observability | Sentry, Pino, OpenTelemetry, Web Vitals/RUM, dashboards, alerts, SLOs, error budgets, and incident runbooks. |

Expensive technologies are implemented in Phase 1 behind stable contracts, dynamic imports, feature flags, benchmarks, and fallbacks. They may be activated on constrained surfaces before broader rollout, but they are not removed from the architecture.

## Three-phase execution model

### Phase 1 — Google-indexable foundation and first complete product

Phase 1 establishes the architecture and delivers the first complete usable product. It includes the design system, English and Hindi/Devanagari foundations, canonical data model, public server-rendered pages, page authority, metadata, JSON-LD, crawlable links, sitemaps, facets, lifecycle rules, freshness, internal links, quality gates, focused guides, Search Console, core search, filters, save, compare, leads, maps, media, RERA, broker workflows, authentication, security, privacy, backups, observability, testing, and the off-page authority seed program.

Phase 1 must work without WebGL, an LLM, semantic search, or heavy map layers. Those capabilities improve the experience but cannot be required for core page facts, search, or SEO.

### Phase 2 — SEO scale, advanced discovery, and activation

Phase 2 activates advanced deck.gl layers, pgvector similarity, recommendations, LLM fallback, reviewed Hindi SEO publication, larger city/locality/project/guide coverage, richer video and 3D experiences, advanced Search Console and authority dashboards, internal-link recommendations, RERA/freshness automation, broker/lead automation, recurring market reports, digital PR, and measured scale improvements.

### Phase 3 — Authority optimization and regional expansion

Phase 3 delivers controlled SEO and conversion experiments, title/snippet testing, internal-link experiments, advanced semantic and AI search, additional Indian languages, new cities and localities, flagship research, industry partnerships, commercial broker products, multi-region recovery, and evidence-based UX/motion optimization.

## Google-first SEO strategy

Google is the primary search priority. The following are mandatory in Phase 1:

```text
server-rendered public HTML
→ crawlable <a href> navigation
→ stable canonical URL builder
→ Home → hubs → cities → localities → intent → entities hierarchy
→ metadata and JSON-LD generators
→ canonical-only sitemaps
→ robots and faceted-navigation rules
→ correct listing lifecycle status codes
→ freshness and meaningful-update events
→ breadcrumbs and contextual internal links
→ orphan and click-depth detection
→ qualified-intent quality gates
→ focused original guides
→ mobile composition and Core Web Vitals/RUM
→ Google Search Console integration
→ raw HTML and no-JavaScript SEO tests
→ compliant Phase 1 off-page authority seed program
```

The system must never promise rankings. It is designed to compete through better locality coverage, original data, RERA trust, freshness, useful content, page experience, internal authority, and legitimate external recognition.

## Off-page authority

Technical SEO is necessary but not sufficient for a new domain competing with established real-estate portals. Phase 1 therefore begins a compliant authority and digital PR program.

The strategy is based on original research, useful public resources, legitimate relationships, expert commentary, relevant publisher outreach, and earned editorial recognition. Suitable assets include RERA explainers, city/locality market snapshots, locality comparisons, project-verification methodology, an India property glossary, public research tables, and local housing reports.

Government and RERA websites are sources, not implied endorsers. Developer and broker partnerships must not require followed links. Paid placements must be disclosed and qualified with `rel="sponsored"` or `nofollow`. The project must not buy ranking-passing links, operate link exchanges, use automated link creation, publish low-quality directory links, or run mass guest-post networks.

Phase 1 seeds relationships and assets. Phase 2 scales recurring reports, local media, research collaborations, expert commentary, and qualified outreach. Phase 3 compounds flagship research, regional-language assets, industry partnerships, and brand reputation.

## Information architecture

The public route model uses stable ASCII slugs and localized visible names:

```text
/buy/
/rent/
/buy/{city}/
/rent/{city}/
/buy/{city}/{locality}/
/rent/{city}/{locality}/
/buy/{city}/{locality}/{qualified-intent}/
/project/{city}/{project-slug}/
/listing/{city}/{locality}/{listing-slug}-{stable-id}/
/broker/{city}/{broker-slug}/
/rera/{state}/{registration-number}/
/guide/city/{city}/{guide-slug}/
/guide/locality/{city}/{locality}/{guide-slug}/
```

The canonical entity graph contains cities, localities, projects, listings, brokers, RERA records, guides, media, sources, and evidence. Each indexable page has one primary search intent and a clear owner in `SeoPage`.

## India localization

Hindi/Devanagari is a Phase 1 foundation because retrofitting it later affects typography, layout, search aliases, metadata, routing, structured data, and QA.

Store English and Hindi names, ASCII slugs, English and Hindi aliases, transliterations, phonetic forms, locale, translation status, alternate URLs, and editorial review status. Use stable ASCII slugs for URLs and localized Hindi display names. Add `hreflang` only when an alternate page is genuinely translated, equivalent, canonical, indexable, and useful. Support mixed-language queries, transliteration, Unicode normalization, aliases, and locale-aware INR, dates, areas, and numbers.

## Security and privacy baseline

The project requires CSP, HSTS, Permissions Policy, secure cookies, CSRF controls, XSS-safe rendering, SSRF protection, WAF/bot controls, rate limits, upload scanning, MIME validation, EXIF stripping, moderation, quotas, retention, audit logging, SBOM, dependency scanning, secret scanning, migration controls, and incident runbooks.

The India privacy posture includes notice, purpose limitation, consent and withdrawal, access/correction/deletion, processor inventory, retention, PII redaction, encryption, role boundaries, breach response, child safeguards, and legal review.

## Governance and implementation documents

| File | Authority and purpose |
|---|---|
| `governance/feedback/FEEDBACK-REVIEW.md` | Accepted/rejected governance suggestions and resolved contradictions. |
| `governance/contracts/REQUIREMENTS.md` | Stable requirement IDs, owners, status, and acceptance evidence. |
| `governance/contracts/DOMAIN-CONTRACTS.md` | Executable domain contracts and invariants. |
| `governance/contracts/IMPLEMENTATION-MATRIX.md` | Work IDs, owners, dependencies, planning estimates, entry/exit criteria, and evidence. |
| `governance/decisions/DECISION-LOG.md` | Stable decisions, rationale, affected requirements/work, evidence, and reversal triggers. |
| `governance/legal/LEGAL-GATES.md` | Legal and compliance approvals required before public enablement. |
| `governance/decisions/SUPERSESSION-MANIFEST.md` | Normative versus historical document status and reading order. |
| `ARCHIVE_INDEX.md` | Historical archive index. |

## How an AI coding system should use this repository

An AI coding system must read `architecture/normative/final-three-phase-architecture.md` before writing production code; treat the canonical entity model, route grammar, `SeoPage` registry, page-authority hierarchy, and server-rendering contract as foundational; preserve approved capabilities through interfaces, feature flags, dynamic imports, benchmarks, and fallbacks; never invent property, price, availability, or RERA facts; use real `<a href>` links for public pages; keep public content server-first; maintain localization fields; run SEO, accessibility, security, performance, and mobile tests; avoid manipulative link tactics; and document any changed architecture decision.

## Version history

| Version | Main purpose |
|---|---|
| v1 | Original technical stack and product plan. |
| v2 | Full first-phase stack with premium motion, SEO, and AI-discovery requirements. |
| v3 | Expanded crawlable information architecture, entity graph, sitemaps, facets, and lifecycle rules. |
| v4 | Page-authority architecture and SEO-factor solution mapping. |
| v5 | 2026 technology, security, observability, passkey, privacy, media, and platform updates. |
| v6 | Complete AI-readable consolidation of v1–v5. |
| v7 | General feedback integration, Next.js stability, Hindi foundation, Railway decision, leads, email, and privacy. |
| v8 | SEO feedback integration and the complete Google-first SEO control plane. |
| Final | Complete three-phase execution architecture plus Google-first off-page authority. |

## Document map

| File | Use |
|---|---|
| `architecture/normative/final-three-phase-architecture.md` | Current implementation source of truth. |
| `seo/authority/off-page-authority-google-first-appendix.md` | Google-first authority, digital PR, and compliant link-earning strategy. |
| `history/recommendations/recommendation-v1.md` through `history/recommendations/recommendation-v8.md` | Historical versioned recommendations. |
| `planning/three-phase-execution-appendix.md` | Standalone Phase 1/2/3 execution details. |
| `history/reviews/v7-feedback-decision-report.md` | General feedback decisions for v7. |
| `seo/execution/v8-seo-feedback-decision-report.md` | SEO feedback decisions for v8. |
| `history/appendices/v7-accepted-feedback-appendix.md` | Accepted v7 feedback implementation updates. |
| `history/appendices/v8-accepted-seo-appendix.md` | Accepted v8 SEO implementation updates. |
| `history/reviews/final-technical-stack-review.md` | Initial technical-stack and UI-first review. |
| `ARCHIVE_INDEX.md` | Historical archive index. |
| `governance/feedback/FEEDBACK-REVIEW.md` | Governance feedback decisions and contradiction resolution. |
| `governance/contracts/REQUIREMENTS.md` | Stable requirement registry. |
| `governance/contracts/DOMAIN-CONTRACTS.md` | Executable domain contracts. |
| `governance/contracts/IMPLEMENTATION-MATRIX.md` | Workstream and acceptance matrix. |
| `governance/decisions/DECISION-LOG.md` | Stable architecture decisions. |
| `governance/legal/LEGAL-GATES.md` | Legal/compliance release gates. |
| `governance/decisions/SUPERSESSION-MANIFEST.md` | Normative and historical document status. |
| `governance/CHANGELOG.md` | Version evolution and governance update history. |

## Definition of done

A feature is complete only when it is typed, versioned, observable, secure, accessible, privacy-reviewed, crawlable where public, canonical where public, fallback-capable, rollback-capable, tested on mobile and desktop, and documented for human and AI engineers.

## Final principle

> **Phase 1 makes the platform technically excellent, Google-indexable, and ready to earn legitimate recognition. Phase 2 expands useful content, advanced discovery, localization, and authority. Phase 3 compounds rankings, trust, brand, regional coverage, and commercial value through measured optimization.**
