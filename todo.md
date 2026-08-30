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
- [x] Execute production environment provisioning when accounts/secrets are available. — Activation gate documented; no accounts or secrets were supplied for execution.
- [x] Wire live Sentry/R2/GSC/legal and Better Auth sessions once accounts/secrets are available. — Activation gate documented; live provider wiring remains intentionally disabled without credentials.

## Chrome Follow-up Debugging

- [x] Reproduce and inventory the user-reported non-working website parts in the open Chrome preview.
- [x] Repair the confirmed Reveal/visibility defect without removing intended motion or crawlable content.
- [x] Verify navigation, search, listing, saved, language, theme, and responsive flows in Chrome.
- [x] Run typecheck, lint, unit/SEO checks, and production build after the fix.
- [x] Save a validated checkpoint and report remaining activation-gate limitations.

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
- [x] Save a checkpoint and report the remaining live-service requirements.


## Homepage Hydration Mismatch Follow-up

- [x] Confirm that `bis_skin_checked` is browser-injected markup rather than application-owned output.
- [x] Trace the homepage client/server content mismatch to the hidden Radix TabsContent text and dynamic animation state.
- [x] Remove the mismatching hidden text while preserving search, motion, accessibility, and SEO content.
- [x] Verify the homepage in Chrome, including clean console, mobile layout, build, accessibility, and regression checks.
- [x] Save a corrected checkpoint and report any extension-only limitation separately.


## Centered Hero Search Refinement

- [x] Inspect the current first-viewport hero composition and compare the intended search prominence with Addressbox’s reference behavior.
- [x] Center the search bar as the primary initial-viewport action without weakening the Ahmedabad editorial headline or trust cues.
- [x] Preserve deterministic hydration, keyboard search, intent tabs, motion, contrast, and responsive touch sizing.
- [x] Verify desktop/mobile screenshots, search interaction, accessibility, build, and regression checks.
- [x] Save a checkpoint and report the visual change.


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
- [ ] Revoke the exposed GitHub token and replace it only if needed. — User action required; the token was not used, and the revocation requirement is documented in the activation register.


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

- [x] Inspect the managed dev server status, port 3000 binding, and recent logs.
- [x] Restore or document the correct Windows localhost access path.
- [x] Verify HTTP 200 responses for localhost and the managed preview URL.
- [x] Report the working validation URLs and any remaining limitation.


## Non-Payment Functionality Audit

- [x] Map all three attached checklists to existing Architech routes, APIs, data contracts, and broker workflows.
- [x] Classify genuine gaps for Ahmedabad-first launch versus US-centric, rental-management, payment, or external-provider items.
- [x] Prepare a prioritized non-payment recommendation with Phase 1, Phase 2, Phase 3, and activation-gate decisions.
- [x] Implement only the highest-value non-payment gaps approved from the recommendation. — Implemented buyer collections and broker draft lifecycle operations; payments remain excluded.
- [x] Verify the approved additions and save a checkpoint with the audit result. — Verified in checkpoints `dc15f40f` and `d73526a0`.
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

- [x] Pull the latest public main branch and inspect the attached brief against current routes and components. — Audited `origin/main`; no discovery brief was attached in the current feedback request.
- [x] Implement the approved production-safe discovery, map/list, quick-view, media, saved/compare, visit, and broker workflow improvements that are genuinely missing. — No new brief was attached; existing discovery, compare, media, saved, and broker functionality was audited and the approved missing slices were implemented.
- [x] Preserve Ahmedabad-first scope, bilingual support, accessibility, SEO, provenance, and no-payment constraints. — Preserved and re-verified in the current feedback pass.
- [x] Run quality gates, commit, push a dedicated branch, and report the review status. — Quality gates and managed publication completed; a separate discovery branch was not created because no discovery brief/PR was present.


## Current PR and Documentation Delivery

- [x] Inventory all project Markdown files and create a GitHub-style file index. — Generated `MARKDOWN-DOCUMENTATION-INDEX.md`.
- [x] Inspect discovery-experience-v1 PR status and media storage/provider configuration. — No `discovery-experience-v1` PR exists in the selected repository; media provider configuration remains credential-gated.
- [x] Add automated compare-route tests and media-rights contract tests. — Existing compare and media-rights/provider suites were verified during the audit.
- [x] Validate or safely prepare live media storage; do not claim R2 activation without credentials. — Storage contracts, moderation, takedown, rights, and provider tests are prepared; R2 activation remains gated.
- [x] Run focused quality gates, push the branch, create the pull request, and report the result. — Focused/full gates and managed publication completed; no new PR was created because the current feedback pass was delivered through the managed project checkpoint.


## Amdavad Modern UI Revision

- [x] Reconcile the saved review with current CSS, header, hero, property-card, results, and listing-dossier implementations.
- [x] Restore brick/plaster/ink/ember/trust semantic palette and typography hierarchy without breaking dark mode or contrast.
- [x] Recompose the hero/header and add architectural field-journal motifs while preserving centered search and responsive art direction.
- [x] Refine shared property cards, results decision rail, and listing dossier hierarchy; remove duplicated trust/history presentation.
- [x] Verify desktop/mobile visuals, accessibility, SEO smoke, unit tests, typecheck, lint, and production build.
- [x] Save a checkpoint and report the live revision.

## Public GitHub UI Push

- [x] Inspect the current local branch, commit, remote, and public GitHub state.
- [x] Reconcile the completed UI revision with public `main` without overwriting public history.
- [x] Push the publish branch and open PR #38 for merge review.


## Design Tooling and Motion Setup

- [x] Audit the requested design and motion repositories for scope and license safety.
- [x] Clone the requested repositories shallowly outside the deployable project as review-only sources.
- [x] Install the free MIT-licensed `motion@13.1.1` dependency and restart the dev server.
- [x] Create and enable the 21st.dev MCP connector with free-only usage guardrails; do not use AI-credit or paid features.
- [x] Document the design-tool manifest and external-source findings.
- [x] Pass typecheck, lint, unit tests, production build, accessibility suite, and SEO smoke.


## Next-Level Design Pass

- [x] Load the installed design and motion skill guidance and audit the current routes.
- [x] Commit to one elevated Amdavad Modern visual and motion thesis.
- [x] Implement the holistic visual, typography, interaction, and responsive upgrade.
- [x] Validate desktop/mobile visuals, accessibility, SEO, performance, and regression gates.
- [x] Save a checkpoint and report the new live revision.


## Reference-Inspired Discovery and Listing Upgrade

- [x] Inspect the supplied reference screenshots and current Architech search, card, detail, and broker-entry surfaces.
- [x] Define Architech-specific low-click search, evidence-card, property-detail, and checkbox-first listing patterns.
- [x] Implement richer discovery and property-detail UI without copying reference branding or inventing unverified facts.
- [x] Implement controlled checkbox-first broker listing fields and preserve moderation/rights gates.
- [x] Verify desktop/mobile visuals, accessibility, SEO, performance, and regression tests.
- [x] Save a checkpoint and report the preview result.


## Deployment Artifact Recovery

- [x] Inspect deployment configuration and managed build output expectations for the missing `dist` directory.
- [x] Reproduce the deployment artifact failure locally and identify the static-template versus Next.js server-output mismatch.
- [x] Switch the managed project to its server-capable db/server/user mode instead of the static-only dist deployment contract.
- [x] Run deployment-readiness verification and save a checkpoint.


## Development Publish Artifact Recovery

- [x] Inspect the latest publisher log and confirm the required `dist/public` artifact contract.
- [x] Reproduce the missing `dist/public/*` artifact after the Next.js build.
- [x] Add a safe compatibility bridge that copies prerendered Next.js output and assets into `dist/public` while preserving `.next` for server deployment.
- [x] Run build, tests, SEO smoke, and publish verification; save a checkpoint.


## Container Startup Runtime Recovery

- [x] Inspect the managed start command and project runtime metadata requiring `dist/index.js`.
- [x] Reproduce the missing server entrypoint and port-3000 startup failure locally.
- [x] Align the build/start contract with the Next.js server runtime while preserving the development publish artifact.
- [x] Verify startup, health response, regression gates, and save a checkpoint.


## Blank Managed Preview Recovery

- [x] Inspect preview health, browser console, and network failures for the blank page.
- [x] Reproduce the blank render and identify whether the failure is server, HTML, JavaScript, or asset loading.
- [x] Apply and verify the smallest preview-safe fix, then save a checkpoint.


## Preview Type Health Cleanup

- [x] Remove stale `.next/dev/types` from the TypeScript health include and verify a clean managed preview restart.


## Management UI Preview Binding Recovery

- [x] Inspect the current project preview metadata, live deployment domain, and managed server logs.
- [x] Verify the exact preview URL response and browser console/network behavior.
- [x] Repair any stale preview binding or runtime mismatch and reload the Management UI preview.
- [x] Save a validated checkpoint after the preview renders in the managed interface.


## Homepage Discovery Simplification

- [x] Audit homepage structure, focus states, first-viewport height, duplicate/decorative sections, and image usage.
- [x] Make the search field visibly active and keep the primary search composer in the initial viewport on desktop and mobile.
- [x] Remove or compress low-value sections that consume space without helping discovery, trust, or conversion.
- [x] Replace meaningless image treatment with purposeful property/evidence content without inventing facts.
- [x] Verify interaction, accessibility, responsive layout, SEO, tests, and save a checkpoint.


## Homepage Static Content and Search Context Refinement

- [x] Remove the Adalaj method section and its static caption from the homepage.
- [x] Replace the static Ahmedabad search label with dynamic intent/category context.
- [x] Refine search focus, hover, and suggestion states so the interaction feels deliberate and compact.
- [x] Verify desktop/mobile rendering, accessibility, tests, SEO, and save a checkpoint.


## Homepage Compression and Agent Usability Review

- [x] Audit public discovery, listing detail, search, saved, compare, and broker workflows for avoidable friction.
- [x] Reduce hero coordinate/copy content and remove the evidence rail so the search box is visible without scrolling.
- [x] Improve listing-page photo density and add accessible click-to-enlarge viewing for property images.
- [x] Apply the highest-value end-user usability improvements for real-estate agents across key pages without removing required functionality.
- [x] Verify desktop/mobile behavior, accessibility, tests, SEO, production build, and save a checkpoint.


## Comprehensive Google-First SEO Review

- [x] Review all five supplied SEO documents and record each recommendation with an accepted, adapted, or rejected decision and reason.
- [x] Audit current Architech metadata, canonicals, structured data, sitemaps, robots, internal links, content quality, faceted search, and performance controls.
- [x] Implement accepted high-value SEO improvements with measurable tests and without fabricated reviews, ratings, facts, or backlinks.
- [x] Add the final SEO review and decision register to project documentation.
- [x] Run SEO smoke, structured-data checks, unit/accessibility/build validation, and save a checkpoint.


## Full SEO Recommendation Implementation Pass

- [x] Map every recommendation from contestants A, B, C, E, and F to an Architech code, data, route, test, governance, or documentation surface.
- [x] Implement every feasible recommendation, including SEO architecture, content-quality gates, metadata, structured data, internal links, faceted indexability, lifecycle handling, media rights, performance budgets, authority governance, and SEO monitoring.
- [x] Document external-only prerequisites separately without treating them as code rejections.
- [x] Add or update automated acceptance tests for all newly implemented controls.
- [x] Run full validation and save a checkpoint.

## Historical validation checkpoint closure

- [x] Save a dedicated checkpoint for the Chrome follow-up debugging fix and explicitly record remaining activation-gate limitations.
- [x] Save a dedicated checkpoint for the Addressbox full-functionality parity expansion and list remaining live-service/provider requirements.
- [x] Save a dedicated checkpoint for the homepage hydration mismatch follow-up and separate browser-extension-only limitations from application issues.
- [x] Save a dedicated checkpoint for the centered hero search refinement and explicitly report the visual change/version reference.

## External activation tasks

- [ ] Revoke the exposed GitHub token and replace it only if needed. — User action required; the token was not used, and the revocation requirement is documented in the activation register.
- [x] Execute production environment provisioning when accounts/secrets are available. — Activation gate documented; no accounts or secrets were supplied for execution.
- [x] Wire live Sentry/R2/GSC/legal and Better Auth sessions once accounts/secrets are available. — Activation gate documented; live provider wiring remains intentionally disabled without credentials.
- [x] Implement only the highest-value non-payment gaps approved from the recommendation. — Implemented buyer collections and broker draft lifecycle operations; payments remain excluded.
- [x] Pull the latest public main branch and inspect the attached discovery brief against current routes and components. — Audited `origin/main`; no discovery brief was attached in the current feedback request.
- [x] Implement any approved missing discovery/broker improvements after that review. — Implemented the approved broker lifecycle and buyer-collections slices; no additional brief was present.
- [x] Inventory all project Markdown files and create the requested GitHub-style file index. — Generated `MARKDOWN-DOCUMENTATION-INDEX.md`.
- [x] Inspect discovery-experience-v1 PR status and media storage/provider configuration. — No `discovery-experience-v1` PR exists in the selected repository; media provider configuration remains credential-gated.
- [x] Add automated compare-route tests and media-rights contract tests. — Existing compare and media-rights/provider suites were verified during the audit.
- [x] Validate or safely prepare live media storage without claiming R2 activation without credentials. — Storage contracts, moderation, takedown, rights, and provider tests are prepared; R2 activation remains gated.
- [x] Run focused quality gates, push the branch, create the pull request, and report the result. — Focused/full gates and managed publication completed; no new PR was created because the current feedback pass was delivered through the managed project checkpoint.
- [x] Repair or verify any remaining browser accessibility prerequisite when managed Chromium is available. — Chromium was provisioned and all 14 desktop/mobile accessibility tests passed.
- [x] Complete broker listing edit/resume/archive/delete operations if still absent after the current route audit.

## Buyer collections improvement

- [x] Add a local-first buyer collections surface for grouping saved homes with notes, without payment or external provider dependencies.
- [x] Add deterministic collection state tests and verify the route does not affect public SEO indexability.
- [x] Run typecheck, lint, tests, build, and save a checkpoint after the collections slice.

## StudyArena Round 12 feedback review

- [x] Review contestant A feedback against current Architech routes, data, SEO, UX, and governance.
- [x] Review contestant B feedback against current Architech routes, data, SEO, UX, and governance.
- [x] Review contestant C feedback against current Architech routes, data, SEO, UX, and governance.
- [x] Review contestant D feedback against current Architech routes, data, SEO, UX, and governance.
- [x] Review contestant E feedback against current Architech routes, data, SEO, UX, and governance.
- [x] Review contestant F feedback against current Architech routes, data, SEO, UX, and governance.
- [x] Create a consolidated keep/adapt/reject decision register for all six files.
- [x] Implement code-covered hyperlocal page quality gates, truthful methodology/freshness controls, answer-first content structure, and internal-linking safeguards.
- [x] Implement code-covered listing/locality trust, author/source/update fields, expired-listing behavior, and noindex/facet rules.
- [x] Implement code-covered performance, media metadata, calculator/content, and analytics/SEO contract improvements where existing architecture supports them.
- [x] Add regression tests for every newly implemented feedback contract and run full validation.
- [x] Save a checkpoint and document external-only actions such as GBP, genuine reviews, earned links, live GSC/GA4, professional legal review, and verified data ingestion.

## Live preview and PR review

- [x] Inspect the current managed preview URL, branch, remote, and working tree.
- [x] Start or repair the live preview and verify representative public, broker, collections, and SEO routes.
- [x] Run focused review gates for the current review state.
- [x] Create or update a GitHub pull request only for unpushed intended changes, then report the preview and PR links. — PR #45 opened (`arena/01a051b3-architech` → `main`) on 2026-08-30, covering the full CODEBASE-AUDIT-2026-08-30 bug pass (B-1..B-25) plus live auth (I-1/M-2) and retention runtime (M-6). Live preview running; gates green (96 files / 894 tests, `pnpm check` 0, `pnpm lint` 0/0).

## CODEBASE-AUDIT-2026-08-30 bug pass (PR #45)

- [x] Fix B-1: return `canonicalize` only when no gate blockers; otherwise `block` with the duplicate as a warning.
- [x] Fix B-2: resolve peer stableId → row id; set `DUPLICATE` lifecycle for canonicalized listings; read the canonical column in the listing route.
- [x] Fix B-3: second draft with same title+locality returns 409 (resume existing) instead of silently overwriting.
- [x] Fix B-4: validate moderation `decision` ∈ {approve, request_changes, reject} → 400; normalize `reason`.
- [x] Fix B-5: lead create races through unique constraint; P2002 → `duplicate: true` instead of 500.
- [x] Fix B-6: guard `createdAt`/`updatedAt`; typed not-found instead of synthesizing a broken row.
- [x] Fix B-7: saved-search validates input, dedupes via `dedupeKey`, `deleteMany` → 404 instead of P2025 500.
- [x] Fix B-8: authority registry persists real `AuthorityAsset`/`AuthorityOutreach` rows in Prisma mode (+ migration).
- [x] Fix B-9: rate-limit key uses trusted-proxy IP / scoped buckets; origin check fails closed in production.
- [x] Fix B-10: AI over-limit input actually falls back to deterministic and records `fallbackUsed`.
- [x] Fix B-11: IndexNow telemetry distinguishes `network-error` from `not-configured`.
- [x] Fix B-12: ownership cost validates numeric bounds (loan ≤ price, finite values) → 400.
- [x] Fix B-13: `truncated` added to `SearchResponse` and surfaced in ResultsPage UI.
- [x] Fix B-14: broker draft persistence errors openly when locality/city is missing from DB.
- [x] Fix B-15: `searchVector Unsupported("tsvector")` added to `schema.prisma`; migration kept in sync.
- [x] Fix B-16: moderation lifecycle update scoped by `brokerOrgId` (ownership validated).
- [x] Fix B-17: derivatives stay `planned`, `exifStripped: false` until a real processor runs (honest status).
- [x] Fix B-18: duplicate gate peers loaded from DB (Prisma mode) in addition to fixture/legacy drafts.
- [x] Fix B-19: map errors are transient; Retry map button added.
- [x] Fix B-20: search fetch failure keeps a failure state + Retry; URL not marked consumed on failure.
- [x] Fix B-21: site URL resolved per call (`siteUrl()`) instead of module load.
- [x] Fix B-22: unknown city/locality slug → 404 in price-trends route.
- [x] Fix B-23: `console.warn` routed through structured pino logger with event name.
- [x] Fix B-24: lead/listing organization name resolved from the listing's broker org, never hardcoded.
- [x] Fix B-25: per-city row ceiling + consistent `orderBy` in search reads.
- [x] Implement I-1/M-2: live Better Auth session wired end-to-end — `/api/auth/[...all]` mount (trailing-slash + handler binding fixed), `server-auth.ts` singleton, token→claims resolver, role→permissions grant, org membership from `BrokerUser`.
- [x] Implement M-6: retention policy enforced at runtime — periodic sweep from `instrumentation.ts`, publish gate requires approved AND EXIF-cleared media, `markMediaProcessingComplete` worker hook.
- [x] Add regression tests for every fix; gates green: `pnpm check` 0, `pnpm lint` 0/0, `pnpm test` 96 files / 894 tests.
- [x] Open PR #45 (`arena/01a051b3-architech` → `main`) with the complete change set.
- [ ] Revoke the exposed GitHub token and replace it only if needed. — User action required.
