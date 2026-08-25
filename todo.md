# Architech redesign tasks

- [x] Review all user-provided MCP/design references and independent current sources.
- [x] Decide which free MCP/design tools are genuinely useful for Architech.
- [x] Replace Mumbai-first content and routes with Ahmedabad-first content and route labels.
- [x] Define a stronger Ahmedabad visual direction and improve the homepage composition.
- [x] Rework search, locality, and listing surfaces to feel more distinctive and trustworthy.
- [x] Generate or select Ahmedabad-specific visual assets and brand treatments.
- [x] Validate desktop/mobile visuals, motion, accessibility, and build output.
- [x] Save a new checkpoint after the redesign is complete.

## UI/UX Motion Revision

- [x] Record which attached recommendations are accepted, adapted, or declined and why.
- [x] Define an Editorial Terracotta motion system with route transitions, reveal choreography, card interactions, header behavior, and reduced-motion fallbacks.
- [x] Inspect the existing pages and shared components for the highest-value interaction opportunities.
- [x] Implement motion without adding paid services or heavy visual dependencies.
- [x] Add advanced but lightweight behaviors such as scroll reveals, image treatment, saved-state feedback, and contextual filter transitions where appropriate.
- [x] Validate keyboard focus, screen-reader semantics, mobile layout, reduced motion, console errors, and production build.
- [x] Capture final desktop and mobile previews and save a recoverable checkpoint.

## Phase 1 execution tracker

- [x] Add `PHASE-1-IMPLEMENTATION-PLAN.md` as the active pick-one-item Phase 1 tracker.
- [x] Implement Item 2 from the tracker: central canonical URL builder.
- [x] Implement Item 3 from the tracker: formal `SeoPage` registry.
- [x] Implement Item 4 from the tracker: no-JavaScript SEO tests.
- [x] Implement Item 5 from the tracker: accessibility automation.
- [x] Implement Item 6 from the tracker: complete Hindi UI foundation.
- [x] Implement Item 7 from the tracker: Storybook/component documentation.
- [x] Implement Item 8 from the tracker: performance and Core Web Vitals budgets.
- [x] Implement Item 9 from the tracker: Prisma/PostgreSQL/PostGIS schema.
- [x] Implement Item 10 from the tracker: Data access layer/repositories.
- [x] Begin later Phase 1 backlog: backend search API and PostgreSQL FTS/trigram.
- [x] Implement later Phase 1 backlog: MapLibre synchronized map/list experience.
- [x] Implement later Phase 1 backlog: lead persistence and consent/audit backend.
- [x] Implement later Phase 1 backlog: Better Auth and broker organizations.
- [x] Implement later Phase 1 backlog: broker onboarding and listing moderation.
- [x] Implement later Phase 1 backlog: media upload pipeline with moderation and derivatives.
- [x] Implement later Phase 1 backlog: RERA adapter/provenance/correction workflow.
- [x] Implement later Phase 1 backlog: Sentry/logging/RUM/observability.
- [x] Implement later Phase 1 backlog: Google Search Console setup and SEO alerting.
- [x] Implement later Phase 1 backlog: security/privacy/legal gates.
- [x] Implement later Phase 1 backlog: backup/restore/cost operational readiness.
- [x] Implement final Phase 1 release report.
- [x] Begin production enablement planning: environments, DB provisioning, legal approvals, and live adapters.
- [x] Add production environment provisioning and secrets management runbooks/audits.
- [x] Implement production data adapter layer: server-only Prisma repository adapter with fixture fallback.
- [x] Implement structured guide/content system with editorial noindex gates.
- [x] Add deployment manifests and production-like provisioning smoke audit.
- [x] Implement trust & verification score model (`P1-TRUST-001`).
- [x] Implement trust-aware listing surface with JSON-LD (`P1-SEO-008`).
- [x] Implement Prisma persistence adapters for broker/media/RERA (`P1-DATA-004`).
- [x] Implement broker lead inbox with masked-response workflow (`P1-LEAD-001`).
- [x] Implement live moderation queue driving the draft lifecycle (`P1-BROKER-001`).
- [x] Implement trust-aware locality & city pages with JSON-LD (`P1-SEO-008`).
- [x] Implement search suggestions and no-results recovery (`P1-SEARCH-003`, `P1-SEARCH-004`).
- [x] Implement saved-search persistence with memory/prisma adapter (`P1-DATA-005`).
- [x] Implement client error boundaries and redacted error reporting (`P1-OBS-002`).
- [x] Implement search alias & transliteration module (`P1-SEARCH-001`, `P1-I18N-001`).
- [x] Implement optional AI adapter contract with cost/latency telemetry (`P1-SEARCH-002`).
- [x] Implement Better Auth live-session adapter (`P1-AUTH-001`).
- [x] Implement listing lifecycle → HTTP & indexability (`P1-SEO-003`, `P1-SEO-004`).
- [x] Implement guide editorial approval workflow (`P1-CONT-001`).
- [x] Implement observability SLOs, alert thresholds & trace spans (`P1-OBS-001`).
- [x] Implement media retention, takedown & EXIF policy (`P1-MEDIA-001`, `P1-DATA-002`).
- [x] Implement Search Console provider contract (`P1-SEO-004`).
- [x] Implement authority/outreach governance (`P1-OFF-001`).
- [x] Implement security & operational hygiene/rollback checks (`P1-PLAT-001`).
- [x] Implement lead deletion & consent-revocation workflow (`P1-LEAD-001`, `P1-DATA-002`).
- [x] Implement media takedown & deletion workflow (`P1-MEDIA-001`, `P1-DATA-002`).
- [x] Implement search pagination policy & faceted indexability gate (`P1-SEO-003`).
- [x] Implement API contract suite over built route handlers (`P1-TEST-001`).
- [ ] Execute production environment provisioning when accounts/secrets are available.
- [ ] Wire live Sentry/R2/GSC/legal and Better Auth sessions once accounts/secrets are available.

## Status

All redesign and motion-revision tasks completed in the Amdavad Modern overhaul (Aug 2026). See `IMPROVEMENT-REVIEW.md` for the follow-up audit and its implementation. Use `PHASE-1-IMPLEMENTATION-PLAN.md` for the active Phase 1 backlog and acceptance tracking.
