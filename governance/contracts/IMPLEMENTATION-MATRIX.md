# Architech Implementation and Acceptance Matrix

This matrix converts the architecture into executable work. Estimates are planning ranges, not promises. Owners are role owners; the team may assign named people later.

## Status and readiness

```text
planned → contracted → implemented → validated → enabled → retired
```

`contracted` means the interface and acceptance behavior exist. `implemented` means code or operational configuration exists. `validated` means evidence passes. `enabled` means public exposure is approved. A feature can remain implemented and disabled while a legal, performance, editorial, or operational gate is incomplete.

## Phase 1 workstreams

| Work ID | Deliverable | Owner | Dependencies | Estimate | Entry criteria | Exit criteria / evidence |
|---|---|---|---|---:|---|---|
| P1-GOV-001 | Normative document, IDs, decision log, supersession manifest | Tech lead | None | 1–2 days | Archive exists | Governance files approved; all active decisions have IDs. |
| P1-PLAT-001 | Next.js stable 16.x, CI, environments, secrets, deployment | Platform | P1-GOV-001 | 3–5 days | Repository and account access | Preview deploy, rollback, security-patch procedure, health checks. |
| P1-PLAT-002 | Railway API/worker services and managed data services | Platform/SRE | P1-PLAT-001 | 3–7 days | Region and data decisions | Health checks, private networking, backups, pool limits, alerts. |
| P1-DATA-001 | Prisma/PostgreSQL/PostGIS domain schema | Backend/Data | P1-PLAT-002 | 5–10 days | Domain contracts | Migrations, constraints, fixtures, seed data, migration deploy test. |
| P1-DATA-002 | Audit, provenance, lifecycle, deletion, and retention model | Backend/Security | P1-DATA-001 | 3–6 days | Privacy/legal requirements | Audit and deletion tests; retention job; legal gate record. |
| P1-UI-001 | Design tokens, typography, shadcn/Radix components, Storybook | Design/Frontend | P1-GOV-001 | 7–14 days | Brand direction | Component states, accessibility, visual regression, Devanagari test. |
| P1-UI-002 | Premium motion system and fallbacks | Design/Frontend | P1-UI-001 | 5–10 days | Motion rules | Hero, transitions, card/gallery motion, reduced-motion/no-WebGL tests. |
| P1-I18N-001 | English/Hindi fields, aliases, transliteration, dictionaries, formatting | Localization/Frontend | P1-DATA-001, P1-UI-001 | 4–8 days | Locale policy | Mixed-language search and layout/metadata tests. |
| P1-SEO-001 | Canonical URL builder and `SeoPage` registry | SEO/Backend | P1-DATA-001 | 4–8 days | Route grammar | Canonical consistency, ownership, status, quality-state tests. |
| P1-SEO-002 | Server-rendered public templates and metadata/JSON-LD | SEO/Frontend | P1-SEO-001, P1-UI-001 | 10–20 days | Entity snapshots | Raw HTML, no-JS, metadata, JSON-LD, breadcrumb evidence. |
| P1-SEO-003 | Links, facets, pagination, lifecycle, sitemaps, robots | SEO/Backend | P1-SEO-001, P1-SEO-002 | 7–14 days | URL policy | Crawl simulation, sitemap validator, redirect/lifecycle tests. |
| P1-SEO-004 | Google Search Console ingestion and SEO alerting | SEO/Platform | P1-SEO-003 | 3–7 days | Search Console access | Data ingestion, failure alert, anomaly report. |
| P1-CONT-001 | Focused city/locality/RERA/buying/renting guides | Content/SEO | P1-SEO-002, LEG-001 | 10–20 days | Editorial calendar and evidence | Author/reviewer/source/freshness fields; quality approval. |
| P1-SEARCH-001 | PostgreSQL FTS, aliases, trigram, filters, deterministic parser | Search/Backend | P1-DATA-001, P1-I18N-001 | 7–14 days | Search contract | Golden-query accuracy, latency, no-results and fallback tests. |
| P1-SEARCH-002 | cmdk and optional LLM adapter contract | Search/Frontend | P1-SEARCH-001 | 4–8 days | Parser contract | Client fallback, Zod validation, cost/latency telemetry. |
| P1-MAP-001 | MapLibre/deck.gl contracts, clusters, list fallback, benchmark harness | Maps/Frontend | P1-UI-001, P1-SEARCH-001 | 7–14 days | Map data and budgets | Desktop and Redmi Note-class benchmark; fallback passes. |
| P1-MEDIA-001 | R2/Stream upload, derivatives, captions, transcripts, moderation | Media/Security | P1-DATA-001, LEG-001 | 7–14 days | Media rights policy | Signed upload, malware, EXIF, moderation, deletion evidence. |
| P1-RERA-001 | RERA adapter, provenance, freshness, correction workflow | Data/Legal | P1-DATA-002, LEG-001 | 7–14 days | Approved source and terms | Fixture accuracy, evidence, stale/disputed states. |
| P1-AUTH-001 | Better Auth, roles, passkeys, 2FA, recovery, audit | Security/Backend | P1-PLAT-001, P1-DATA-002 | 7–14 days | Identity policy | Auth, authorization, cache isolation, recovery, audit tests. |
| P1-LEAD-001 | Masked/direct consented lead workflow | Product/Backend | P1-AUTH-001, P1-DATA-002 | 5–10 days | Lead contract and legal gate | Idempotency, retries, deletion, consent, notifications, audit. |
| P1-BROKER-001 | Broker onboarding, verification, listing workflow, moderation | Product/Operations | P1-AUTH-001, P1-MEDIA-001, P1-LEAD-001 | 10–20 days | Broker and moderation contracts | Draft/review/active flow, media rights, lead inbox, audit. |
| P1-OBS-001 | Sentry, Pino, OpenTelemetry, RUM, dashboards, SLOs | SRE | P1-PLAT-001 | 5–10 days | Service topology | Traces, logs, alerts, budgets, incident runbook. |
| P1-OFF-001 | Authority baseline, assets, relationship registry, outreach governance | Growth/Legal | P1-SEO-002, LEG-001 | 7–14 days | Research topics and compliance rules | Baseline, asset registry, outreach log, disclosure review. |
| P1-TEST-001 | Full unit/integration/E2E/accessibility/performance/security/SEO suite | QA/SRE | All contracts | 10–20 days | Fixtures and environments | Release report with all required gates. |

## Phase 2 workstreams

| Work ID | Deliverable | Owner | Entry requirement | Exit evidence |
|---|---|---|---|---|
| P2-SEARCH-001 | pgvector similarity and recommendations | Search/ML | P1-SEARCH-001 validated; embedding data quality passes | Model/version telemetry, relevance benchmark, keyword fallback. |
| P2-SEARCH-002 | LLM fallback activation | Search/ML/Security | Deterministic parser coverage and cost budget | Confidence, latency, cost, correction, zero-result recovery report. |
| P2-MAP-001 | Advanced deck.gl heatmap, ScreenGrid, density, price layers | Maps | P1-MAP-001 benchmark passes | Device/network benchmark and flag rollout. |
| P2-I18N-001 | Reviewed Hindi SEO publication | Localization/SEO | Translation/editorial/legal gates | Canonical/hreflang/content/freshness audit. |
| P2-CONT-001 | Recurring market reports and authority assets | Content/Growth | P1-OFF-001 baseline | Report citations, referral traffic, qualified leads. |
| P2-SEO-001 | Advanced authority, crawl, indexation, and internal-link dashboards | SEO/Data | P1-SEO-004 data quality | Anomaly alerts and action queue. |
| P2-BROKER-001 | Lead SLAs, automation, duplicate detection, bulk workflows | Operations/Product | P1-LEAD-001 stable | SLA and quality report. |
| P2-SCALE-001 | Load, pool, job, media, email, and data scale work | SRE | Observability and representative traffic model | Capacity report and cost budget. |

## Phase 3 workstreams

| Work ID | Deliverable | Owner | Entry requirement | Exit evidence |
|---|---|---|---|---|
| P3-SEO-001 | Controlled SEO and conversion experiments | SEO/Product | Stable baseline and traffic | Experiment report, no indexation regression, rollback. |
| P3-I18N-001 | Additional Indian languages and regional expansion | Localization/SEO | Hindi process is repeatable | Translation quality, technical SEO, and support readiness. |
| P3-AUTH-001 | Flagship research and industry partnerships | Growth/Research/Legal | Authority measurement and compliance | Research citations, qualified traffic, brand-query change. |
| P3-COM-001 | Commercial broker products and lead monetization | Product/Legal/Finance | Lead quality, consent, fraud, attribution | Commercial/legal approval and transparent disclosure. |
| P3-RES-001 | Multi-region and cross-provider recovery | SRE/Security | RPO/RTO evidence and business case | Recovery exercise and migration runbook. |

## Global acceptance rules

A work item cannot be marked `validated` without linked evidence. Evidence may be a test report, screenshot set, benchmark, signed legal approval, audit export, migration result, monitoring dashboard, or rollback exercise. A failed acceptance test creates a remediation task linked to the same Work ID; it does not silently change the requirement.
