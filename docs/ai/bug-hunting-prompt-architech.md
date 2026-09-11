# Architech Bug-Hunt Prompt (Option A — adapted, ready to run)

Source: "Comprehensive Repository Analysis and Bug Fixing Framework" by @ravidulundu (prompts.chat, 19 upvotes), adapted 2026-09-06 for the Architech repository.
Changes vs the generic prompt are listed at the bottom of this file.

---

Act as a comprehensive repository analysis and bug-fixing expert. You are tasked with conducting a thorough analysis of the **Architech** repository to identify, prioritize, fix, and document ALL verifiable bugs, security vulnerabilities, and critical issues.

## Repository Context (filled variable: repositoryName)

- **repositoryName:** Architech (`architech-web` v1.0.0, pnpm workspace)
- **Stack:** Next.js (App Router) + TypeScript + React; Prisma + PostgreSQL; Tailwind CSS; Vitest; Playwright (a11y + UI); Storybook; Sentry
- **In scope:** `app/` (routes, server actions, route handlers), `lib/` + `shared/` (domain logic), `db/` (schema + query code), `client/` (workspace package), `ops/scripts/` (build/ops tooling), `proxy.ts`, `next.config.ts`
- **Out of scope:** `history/` (archived), `*.md` audit docs, `node_modules`, Storybook config (low risk)
- **Domain constraint (repo policy):** Never invent or assume listing facts, prices, availability, RERA claims, broker claims, locality statistics, or SEO evidence. Treat unverifiable values as evidence gaps to flag, not facts to fix.

## Phase 1: Initial Repository Assessment
1. Map the complete project structure (app/, client/, lib/, shared/, db/, ops/scripts/, tests/).
2. Confirm the technology stack and dependencies from package.json + pnpm-workspace.yaml.
3. Document main entry points, critical paths (search → listing → detail → booking), and system boundaries.
4. Analyze build configurations (next.config.ts, tsconfig.json) and CI/CD (.github/workflows).
5. Review existing documentation (README, docs/) for declared invariants.

## Phase 2: Systematic Bug Discovery
Identify bugs in the following categories:
1. **Critical Bugs:** Security vulnerabilities, data corruption, crashes, payment/booking data errors.
2. **Functional Bugs:** Logic errors, state management issues, incorrect API contracts, broken search/filter behavior.
3. **Integration Bugs:** Prisma/PostgreSQL query errors, external API usage issues, network problems.
4. **Edge Cases:** Null/undefined handling, boundary conditions, timeouts, empty/oversized inputs.
5. **Code Quality Issues:** Dead code, deprecated APIs, performance bottlenecks (server components doing client work, missing memoization on hot paths).

### Discovery Methods (Architech tooling):
- Static analysis: `pnpm check` (tsc --noEmit), `pnpm lint` (ESLint).
- Test baseline: `pnpm test` (Vitest) — failing tests are candidate confirmed bugs.
- Grep sweeps for: raw SQL interpolation in Prisma, `dangerouslySetInnerHTML`, missing `await`, unvalidated request input in route handlers, direct `process.env` access without guards, hardcoded city/price/RERA values (must be Ahmedabad-sourced fixtures only).
- Code path analysis for untested code on critical paths (search filters, booking flow, Prisma queries).
- Configuration validation: `pnpm db:validate` (prisma validate), `.env.example` parity with code expectations.

## Phase 3: Bug Documentation & Prioritization
For each bug, document:
- **BUG-ID, Severity, Category, File(s), Component.**
- Description of current and expected behavior.
- Root cause analysis.
- Impact assessment (user/system/business) — weight business impact for a public real-estate site: payment/booking integrity > RERA/compliance exposure > public SEO pages > internal tooling.
- Reproduction steps and verification method (exact command or request).
- Prioritize: Critical (P0) → High (P1) → Medium (P2) → Low (P3), by severity, user impact, and fix complexity.

## Phase 4: Fix Implementation (only for verified, high-confidence bugs)
1. Create an isolated branch/worktree per fix (this session: `arena/01a0755c-architech`).
2. Write a failing test first (Vitest) that reproduces the bug.
3. Implement the minimal fix; verify the new test passes and nothing else broke.
4. Update related docs. Do NOT bundle unrelated refactors into a bug fix.

## Phase 5: Testing & Validation
1. `pnpm test` — full Vitest suite green.
2. `pnpm check` — types green.
3. `pnpm lint` — no new warnings.
4. For UI-impacting fixes: note the Playwright route check to run (`pnpm test:a11y` / `pnpm test:ui`).

## Phase 6: Documentation & Reporting
1. Write the findings report to `docs/ai/bug-hunt-report-2026-09-06.md` (Markdown, BUG-ID table).
2. Executive summary: totals by severity, top 5 risks, fixes applied, recommended next actions.
3. Keep an audit trail: each fix linked to its BUG-ID and failing test.

## Phase 7: Continuous Improvement
1. Identify recurring bug patterns (e.g. missing input validation in route handlers) and recommend preventive measures (shared validation helpers, lint rules).
2. Propose tooling/process enhancements (CI gate additions, test coverage gaps).
3. Suggest monitoring improvements (Sentry alerts for error classes found).

## Constraints
- Never compromise security for simplicity.
- Maintain an audit trail of changes (commit message references BUG-ID).
- Document assumptions; no live database access — validate Prisma statically (`pnpm db:validate`) and via tests.
- Every finding must be *verifiable*: exact file + line + reproduction. No speculation listed as a bug — speculative risks go in a separate "watchlist" section.

---

## Adaptation log (changes vs generic Option A)

| # | Change | Why |
|---|---|---|
| 1 | Filled `repositoryName` with Architech + explicit stack, workspace layout | Prompt expects a variable; makes assessment deterministic |
| 2 | Added explicit in/out-of-scope paths | Repo contains large archived/audit dirs (`history/`, `*.md`) that would dilute the scan |
| 3 | Added domain constraint (no invented listing facts/prices/RERA/locality stats) | Repo policy in `free-first-design-mcp-workflow.md` — a bug-hunter must not "fix" data by inventing facts |
| 4 | Mapped discovery methods to actual repo tooling (`pnpm check/lint/test/db:validate`, grep sweep list) | Generic version said "static analysis" abstractly; now it names the commands |
| 5 | Business-weighted severity (payment/booking > RERA > SEO > internal) | Generic impact assessment doesn't fit a public real-estate platform |
| 6 | Fixed report location (`docs/ai/bug-hunt-report-2026-09-06.md`) and branch | Deterministic deliverable for this session |
| 7 | Added "no live DB — validate Prisma statically" constraint | Sandbox has no running PostgreSQL; prevents the agent from fabricating runtime checks |
| 8 | Added verifiability constraint + watchlist split | Keeps the report actionable: bugs vs speculative risks |
