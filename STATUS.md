# Architech implementation status

**Current revision:** `a77e526` plus the repository-audit hardening and Amdavad Modern UX revision in the active workspace.  
**Product:** Ahmedabad-first, Google-first real-estate discovery platform.  
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

## Implemented hardening

Private broker, admin, moderation, authority, media, RERA-correction, and saved-search routes now use the centralized server-only authorization guard. The guard rejects anonymous or unconfigured live-auth requests, blocks demo authentication in production, checks declared permissions, and applies mutation body-size, origin, and burst controls. Broker workflow mutations receive the authenticated session so organization ownership checks work in memory as well as in persistence adapters.

Sitemap and robots generation now stop advertising public pages until the explicit production indexability flag is enabled. A Next.js proxy adds `X-Robots-Tag: noindex, nofollow` as a final production safety net. Rendered-HTML SEO smoke coverage now includes guide, search-noindex, privacy, and terms route families and passes for 9 routes. The repository also contains a GitHub Actions quality workflow for frozen dependency installation, checks, tests, Prisma validation, and build.

The current UX revision adds a stronger geometric A mark with a terracotta doorway notch, atlas-grid map surfaces with coordinate annotations, a search-page Atlas Lens evidence band, partner-facing broker language, dynamic boundaries for client-only authenticated surfaces, and a bounded Reveal fallback so inventory cannot remain invisible when an observer does not fire. Desktop and mobile visual QA covered the home, search, locality, listing, and broker dashboard routes.

## Source-of-truth order

Read [`README.md`](README.md), [`architecture/normative/final-three-phase-architecture.md`](architecture/normative/final-three-phase-architecture.md), [`governance/contracts/DOMAIN-CONTRACTS.md`](governance/contracts/DOMAIN-CONTRACTS.md), [`PHASE-1-IMPLEMENTATION-PLAN.md`](PHASE-1-IMPLEMENTATION-PLAN.md), and [`docs/runtime-activation-gates.md`](docs/runtime-activation-gates.md). Historical improvement reviews describe earlier repository states and should not override the current application or normative contracts.
