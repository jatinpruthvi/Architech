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
- [x] Implement broker draft listing + live listing-submission form (`P1-BROKER-001`).
- [x] Implement managed Saved-searches page + URL builder (`P1-SEARCH-001`, `P1-DATA-005`).
- [x] Implement server-backed search suggestions + results quick-search (`P1-SEARCH-002`).
- [x] Implement media attach to broker draft (`P1-BROKER-001`, `P1-MEDIA-001`).
- [x] Implement lead privacy/removal actions in inbox (`P1-LEAD-001`, `P1-DATA-002`).
- [x] Implement consolidated observability status endpoint (`P1-OBS-001`).
- [x] Implement discoverable "List your property" seller/owner entry point (`P1-BROKER-001`, `P1-SEO-002`).
- [x] Implement authority/outreach registry + API endpoints (`P1-OFF-001`).
- [x] Harden broker media-attach flow with audit events (`P1-BROKER-001`, `P1-MEDIA-001`).
- [ ] Execute production environment provisioning when accounts/secrets are available.
- [ ] Wire live Sentry/R2/GSC/legal and Better Auth sessions once accounts/secrets are available.

## Chrome Follow-up Debugging

- [x] Reproduce and inventory the user-reported non-working website parts in the open Chrome preview.
- [x] Repair the confirmed Reveal/visibility defect without removing intended motion or crawlable content.
- [x] Verify navigation, search, listing, saved, language, theme, and responsive flows in Chrome.
- [x] Run typecheck, lint, unit/SEO checks, and production build after the fix.
- [ ] Save a validated checkpoint and report remaining activation-gate limitations.

## Status

All redesign and motion-revision tasks completed in the Amdavad Modern overhaul (Aug 2026). See `IMPROVEMENT-REVIEW.md` for the follow-up audit and its implementation. Use `PHASE-1-IMPLEMENTATION-PLAN.md` for the active Phase 1 backlog and acceptance tracking.

## Repository Improvement Audit

- [x] Inventory the latest app, client, governance, SEO, Prisma, testing, and deployment surfaces.
- [x] Check current runtime health, scripts, dependency alignment, and build/lint/test status.
- [x] Review UX and accessibility flows across the main public and broker routes.
- [x] Review crawlability, metadata, structured data, internal linking, and AI-search readiness.
- [x] Review security, authorization boundaries, media uploads, leads, and secrets handling.
- [x] Review performance budgets, image strategy, caching, bundle size, and 4G behavior.
- [x] Prioritize improvements by impact, risk, effort, and phase fit.
- [x] Save a complete audit report with an actionable implementation sequence.

## Audit Implementation

- [x] Add centralized server-side session, permission, and organization-scope guards for every private API family.
- [x] Disable demo sessions and fallback stores in production unless an explicit safe mode is enabled.
- [x] Add route-level abuse controls: request size, rate limit, origin/CSRF, idempotency, and redacted audit logging.
- [x] Make the Better Auth test hermetic and remove the lint warning.
- [x] Add rendered-HTML SEO acceptance tests for public routes and lifecycle variants.
- [x] Add an indexability gate that blocks demo/unapproved data from production metadata and sitemaps.
- [x] Add SEO freshness, source, orphan, canonical, and sitemap observability checks.
- [x] Improve image/font delivery and establish route bundle/build budgets.
- [x] Harden production CSP and environment-specific headers.
- [x] Add mutation idempotency/transaction tests and verify database indexes against query shapes.
- [x] Reconcile README, historical reviews, tracker, and generated project status.
- [x] Complete high-value UX states for save, compare, search, map/list, leads, media, moderation, and Hindi.
- [x] Run full validation and update the tracker; external-account activation remains open.

## Local Preview Recovery

- [x] Inspect the active workspace, dev-server process, port 3000, and recent server/browser errors.
- [x] Restart or repair the local Next.js preview without discarding project changes.
- [x] Verify the root page and representative routes respond successfully in the browser preview.
- [x] Record any remaining environment-specific or external-account blocker and report the working preview URL.

## Localhost Connection Refusal

- [x] Check whether port 3000 is listening and whether the managed preview process is alive.
- [x] Inspect recent server output and deployment/preview metadata for the connection failure.
- [x] Restart or repair the correct local development server without changing application source.
- [x] Verify localhost and the proxied preview URL return the Architech homepage and a representative route.

## Windows Localhost Startup

- [x] Confirm the Windows project path and Node/pnpm availability.
- [x] Start `pnpm dev` from the local Architech repository on the connected Windows computer.
- [x] Verify Windows `127.0.0.1:3000` returns the Architech homepage.
- [x] Report the local terminal state and the URL to open.


## Addressbox Feature Parity

- [x] Inspect the open Addressbox website in Chrome and inventory its public features and key flows.
- [x] Map each observed feature to Architech, separating directly implementable UI behavior from live-service activation gates.
- [x] Implement the agreed compatible feature set without copying Addressbox branding, text, or protected visual assets.
- [x] Verify the new flows in Chrome, including responsive behavior, accessibility, and SEO/indexability safety.
- [x] Save a checkpoint and report any remaining external-service requirements.


## Addressbox Agent Dashboard Parity

- [x] Inspect the provided Addressbox agent dashboard in Chrome and inventory its broker-facing features and states.
- [x] Compare the observed workflow with Architech’s current broker dashboard, leads, listings, media, and moderation surfaces.
- [x] Define secure role, organization-scope, persistence, and external-service activation gates for missing capabilities.
- [x] Implement the missing compatible agent functionality without copying Addressbox branding, text, or protected assets.
- [x] Verify agent flows, authorization boundaries, responsive UX, accessibility, and build quality.
- [x] Save a checkpoint and report remaining live-service requirements.


## Attached Hydration Mismatch

- [x] Read and reproduce the `/dashboard/` hydration warning from the attached report.
- [x] Verify whether `bis_skin_checked` is extension-injected markup or application-generated markup.
- [x] Fix the stale `/dashboard/` route with a server-side redirect while preserving the existing `/broker/dashboard/` route.
- [x] Verify `/dashboard/`, `/broker/dashboard/`, console output, responsive rendering, and regression checks.
- [x] Save a corrected checkpoint and report any browser-extension limitation separately.

## Addressbox Full Functionality Parity Expansion

- [x] Audit all public Addressbox routes, navigation, search, content, conversion, and listing flows.
- [x] Re-check authenticated dashboard, profile, requirements, subscriptions, inventory, AI, auction, tender, shortlist, contacted, and post-property flows.
- [x] Map every capability to an Architech route, reusable domain contract, or explicit external-service gate.
- [x] Implement safe missing functionality without copying Addressbox branding, protected assets, or unverifiable claims.
- [x] Verify public and broker routes, mobile behavior, accessibility, SEO safety, authorization boundaries, and error states.
- [ ] Save a checkpoint and report the remaining live-service requirements.


## Homepage Hydration Mismatch Follow-up

- [x] Confirm that `bis_skin_checked` is browser-injected markup rather than application-owned output.
- [x] Trace the homepage client/server content mismatch to the hidden Radix TabsContent text and dynamic animation state.
- [x] Remove the mismatching hidden text while preserving search, motion, accessibility, and SEO content.
- [x] Verify the homepage in Chrome, including clean console, mobile layout, build, accessibility, and regression checks.
- [ ] Save a corrected checkpoint and report any extension-only limitation separately.


## Centered Hero Search Refinement

- [x] Inspect the current first-viewport hero composition and compare the intended search prominence with Addressbox’s reference behavior.
- [x] Center the search bar as the primary initial-viewport action without weakening the Ahmedabad editorial headline or trust cues.
- [x] Preserve deterministic hydration, keyboard search, intent tabs, motion, contrast, and responsive touch sizing.
- [x] Verify desktop/mobile screenshots, search interaction, accessibility, build, and regression checks.
- [ ] Save a checkpoint and report the visual change.


## Minimum Addressbox Parity and GitHub Push

- [ ] Audit minimum public and authenticated Addressbox functionality against the current Architech routes and interactions.
- [ ] Research open GitHub repositories and license-safe real-estate assets or patterns that can improve Architech without importing untrusted code or unclear licenses.
- [ ] Implement every confirmed minimum functionality gap and document any provider or credential gate.
- [ ] Verify functionality, mobile behavior, accessibility, SEO, tests, production build, and deployment readiness.
- [ ] Commit and push the completed changes to the configured GitHub repository.
