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
- [x] Implement agent/broker profile & reviews (`P1-AGENT-001`).
- [x] Implement listing price history & comparable sales (`P1-DATA-006`).
- [x] Implement listing performance tracking (`P1-OBS-003`).
- [x] Write product feature gap analysis (`docs/product/product-feature-gap-analysis.md`).
- [x] Implement investment metrics (cap rate / cash-on-cash / GRM) (`P1-INVEST-001`).
- [x] Implement price trends by area (`P1-DATA-007`).
- [x] Implement deterministic lead scoring (`P1-LEAD-002`).
- [x] Write product gap alignment doc (`docs/product/product-gap-alignment.md`).
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

- [x] Audit minimum public and authenticated Addressbox functionality against the current Architech routes and interactions.
- [x] Research open GitHub repositories and license-safe real-estate assets or patterns that can improve Architech without importing untrusted code or unclear licenses.
- [x] Implement every confirmed minimum functionality gap and document any provider or credential gate.
- [x] Verify functionality, mobile behavior, accessibility, SEO, tests, production build, and deployment readiness.
- [x] Commit and push the completed changes to the configured GitHub repository via the `architech-parity-overlay` branch and PR #31.


## Merge Addressbox Parity PR
- [x] Confirm PR #31 is open, points to the intended base, and is mergeable.
- [x] Merge PR #31 using the existing authenticated GitHub session; never use the token pasted in chat.
- [x] Verify the public main commit and record the merged PR reference.
- [ ] Revoke the exposed GitHub token and replace it only if needed.


## Best Open-source Real-estate Repository Research

- [x] Define evaluation criteria for property marketplace repositories, including license, maintenance, stack, search, maps, listing, account, agent, and data-source quality.
- [x] Inspect multiple leading open-source real-estate application repositories and verify their licenses and recent activity.
- [x] Score candidates for fit with Architech’s Next.js/Ahmedabad/evidence-first architecture and identify reuse risks.
- [x] Save a referenced comparison and recommend the best repository or reference-only strategy.


## Hozn Reference Reuse — Architech Foundation Preserved

- [x] Verify Hozn’s MIT license, repository structure, recent activity, dependencies, and security-relevant implementation choices.
- [x] Map Hozn’s auth, profile, property CRUD, buying/selling, and UI patterns to Architech’s existing contracts.
- [x] Select only isolated, license-safe patterns that improve Architech without replacing its production foundation.
- [x] Document the approved adaptation strategy with provenance notes and no copied assets, credentials, or unreviewed runtime dependencies.
- [x] Preserve Architech as the production foundation; implementation changes are intentionally limited to documented pattern reuse until a specific improvement is approved.


## Hozn and Online Booking Bounded Reuse

- [x] Verify Online Booking Management license, maintenance, stack, UI patterns, and security-relevant dependencies.
- [x] Create a formal Hozn-to-Architech property-field mapping with provenance, privacy, validation, and indexability decisions.
- [x] Compare the broker draft wizard against Hozn and Online Booking patterns; identify only measurable UX gaps.
- [x] Implement one bounded wizard improvement without importing external code, assets, or dependencies.
- [x] Run type, lint, unit, build, SEO, and database checks; record the Playwright browser prerequisite for accessibility.
- [x] Document license, security, provenance, and accessibility gates for all external patterns.


## Current Localhost Preview Repair

- [ ] Inspect the managed dev server status, port 3000 binding, and recent logs.
- [ ] Restore or document the correct Windows localhost access path.
- [ ] Verify HTTP 200 responses for localhost and the managed preview URL.
- [ ] Report the working validation URLs and any remaining limitation.


## Non-Payment Functionality Audit

- [x] Map all three attached checklists to existing Architech routes, APIs, data contracts, and broker workflows.
- [x] Classify genuine gaps for Ahmedabad-first launch versus US-centric, rental-management, payment, or external-provider items.
- [x] Prepare a prioritized non-payment recommendation with Phase 1, Phase 2, Phase 3, and activation-gate decisions.
- [ ] Implement only the highest-value non-payment gaps approved from the recommendation.
- [ ] Verify the approved additions and save a checkpoint with the audit result.
## Decision dossier & reusable primitives (Aug 2026)

- [x] Add buyer ownership-cost estimator (EMI + stamp duty + registration) (`P1-COST-001`).
- [x] Add PropertyCard variants (grid/horizontal/map-preview) + restrained second-image hover + textual verification.
- [x] Add premium listing gallery (thumbnail rail + fullscreen lightbox) + sticky conversion bar.
- [x] Add Storybook stories for gallery, cost panel, and card variants.
- [x] Re-baseline route first-load raw + total-static-JS budgets (documented).

## Locality intelligence & evidence provenance (Aug 2026)

- [x] Derive locality market facts (current price range, ₹/sq ft, vs-city position) from structured listing facts only (`client/src/lib/realestate/locality-intel.ts`).
- [x] Present provenance labels ("Based on N active verified buy listings · Updated <date>") instead of invented snapshot figures.
- [x] Add inventory by configuration & budget, commute/nearby essentials, and new-projects bands to the locality hub.
- [x] Fix pre-existing rent-mixing in the locality price band (monthly rent was being counted as a buy price).
- [x] Add locality-intelligence unit tests (buy/rent separation, provenance, unknown-locality honesty).
- [x] Add Storybook examples (English + Hindi).
- [x] Re-baseline first-load gzip + total-static-JS budgets (documented, value-driven not feature-stripped).



## Push Current Architech Changes
- [x] Inspect repository instructions, branch, remote, and working-tree changes.
- [x] Review the complete diff and commit all intended current changes.
- [x] Push the commit to the configured public GitHub branch.
- [x] Verify the remote commit and report the result.


## Awesome Real Estate Resource Audit

- [x] Inspect etewiah/awesome-real-estate and the attached resource recommendations.
- [x] Verify license, maintenance signals, resource type, Ahmedabad relevance, and integration risk for promising resources.
- [x] Map safe recommendations to Architech’s existing design, data, SEO, broker, and operations architecture.
- [x] Document what to adopt, study, defer, or reject without importing unreviewed code or assets.


## Attached Discovery and Broker Improvement Brief

- [ ] Pull the latest public main branch and inspect the attached brief against current routes and components.
- [ ] Implement the approved production-safe discovery, map/list, quick-view, media, saved/compare, visit, and broker workflow improvements that are genuinely missing.
- [ ] Preserve Ahmedabad-first scope, bilingual support, accessibility, SEO, provenance, and no-payment constraints.
- [ ] Run quality gates, commit, push a dedicated branch, and report the review status.


## Current PR and Documentation Delivery

- [ ] Inventory all project Markdown files and create a GitHub-style file index.
- [ ] Inspect discovery-experience-v1 PR status and media storage/provider configuration.
- [ ] Add automated compare-route tests and media-rights contract tests.
- [ ] Validate or safely prepare live media storage; do not claim R2 activation without credentials.
- [ ] Run focused quality gates, push the branch, create the pull request, and report the result.


## Amdavad Modern UI Revision

- [x] Reconcile the saved review with current CSS, header, hero, property-card, results, and listing-dossier implementations.
- [x] Restore brick/plaster/ink/ember/trust semantic palette and typography hierarchy without breaking dark mode or contrast.
- [x] Recompose the hero/header and add architectural field-journal motifs while preserving centered search and responsive art direction.
- [x] Refine shared property cards, results decision rail, and listing dossier hierarchy; remove duplicated trust/history presentation.
- [x] Verify desktop/mobile visuals, accessibility, SEO smoke, unit tests, typecheck, lint, and production build.
- [ ] Save a checkpoint and report the live revision.
