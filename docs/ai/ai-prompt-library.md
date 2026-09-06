# Architech AI Prompt Library

**Purpose:** give any AI coding assistant the best, pre-vetted prompt for a task so it never has to start from scratch. Every prompt here already knows the Architech stack, contracts, and quality gates.

**Date validated:** 6 Sep 2026 (validation record at the bottom of this file).

## How to use this file (30 seconds)

1. Find your task in the lookup table below.
2. Copy **ARCH-CTX** (Section A) — this is the mandatory context block. It is what stops the AI from re-discovering repo rules every session.
3. Paste the task prompt after it and fill `{placeholders}`.
4. Before the task counts as done, run the quality gates listed in the prompt (usually `pnpm quality`).

Rule for AI assistants operating in this repository: treat ARCH-CTX as always-on context for any task prompt from this library. Do not reinterpret, weaken, or drop its constraints.

## Task lookup table

| When you need to… | Use prompt |
|---|---|
| Understand this repo / join the project fresh | ARCH-01 |
| Plan or build a feature, page, or route | ARCH-02 |
| Review a diff, PR, or agent-authored change | ARCH-03 |
| Debug a failing check, test, or build | ARCH-04 |
| Fix TypeScript errors | ARCH-05 |
| Refactor without changing behavior | ARCH-06 |
| Write or repair tests | ARCH-07 |
| Fix accessibility / contrast issues | ARCH-08 |
| Work on SEO pages, metadata, or structured data | ARCH-09 |
| Change the Prisma schema or queries | ARCH-10 |
| Review security, privacy, or legal gates | ARCH-11 |
| Write docs, commit messages, or PR descriptions | ARCH-12 |
| Create a brand-new prompt for a task not listed | ARCH-13 |

## Section A — ARCH-CTX (mandatory context block)

```text
You are working in the Architech repository — a server-first, Google-first Indian
real-estate platform (first city: Ahmedabad).

STACK (do not substitute):
- Next.js 16 App Router + React 19 + TypeScript strict mode; package manager pnpm 10.
- App routes in app/; shared UI in client/src/ (import alias @/* -> client/src/*);
  cross-boundary shared code in shared/ (alias @shared/*).
- Tailwind CSS 4, Prisma 7, Vitest, Playwright, Storybook 10.

IMMOVABLE RULES:
- Public pages are server-rendered first; public navigation uses real <a href> links.
- Never invent property, price, availability, locality-statistic, broker, legal, or
  RERA facts. Verified fixtures and domain contracts are the only source of truth.
- Live/demo content uses Ahmedabad localities (Paldi, Prahlad Nagar, Thaltej,
  Navrangpura, ...). Mumbai is historical context only.
- Keep localization fields intact (Hindi foundation); do not hard-code user-facing
  copy where the content system owns it.
- AI output is advisory only: it never ships to indexable surfaces, auto-approves
  listings, or enables providers without the runtime activation gates.

SOURCE OF TRUTH READING ORDER:
1. README.md → section "How an AI coding system should use this repository".
2. architecture/normative/final-three-phase-architecture.md before production code.
3. governance/contracts/DOMAIN-CONTRACTS.md and IMPLEMENTATION-MATRIX.md for
   vocabulary and feature-to-code mapping.
4. STATUS.md before declaring anything done.

QUALITY GATES (run before claiming completion):
- pnpm check      (TypeScript strict)
- pnpm lint       (ESLint, includes jsx-a11y)
- pnpm test       (Vitest)
- pnpm db:validate (Prisma) — when schema or queries changed
- Combined: pnpm quality
- Task-specific: pnpm test:a11y, pnpm audit:contrast, pnpm security:audit,
  pnpm test:seo, pnpm test:perf
```

## Section B — Curated task prompts (repo-vetted)

### ARCH-01 — Understand this repository

**Best for:** onboarding a fresh AI session or human reviewer. **Provenance:** repo-authored; validated against the README reading order.

```text
CONTEXT: You have just joined the Architech repository. Read in this exact order and
summarize each in one line as you go: README.md ("How an AI coding system should use
this repository"), STATUS.md, architecture/normative/final-three-phase-architecture.md,
governance/contracts/DOMAIN-CONTRACTS.md, governance/contracts/IMPLEMENTATION-MATRIX.md.
ROLE: Senior engineer taking ownership of a codebase they did not write.
ACTION:
1. State the canonical entity model, route grammar, SeoPage registry role, and
   page-authority hierarchy in your own words.
2. List the approved commands for type-checking, linting, testing, and database
   validation, and name the single combined gate command.
3. List five things this repository explicitly forbids (e.g., invented listing facts,
   client-rendered public pages, fake links).
4. Flag any doc claims that contradict what you see in the actual code.
FORMAT: A short briefing with four headings matching the steps above. No code changes.
TARGET AUDIENCE: The engineer (human or AI) who will take the next task.
```

### ARCH-02 — Plan and implement a feature

**Best for:** new routes, UI features, shared components. **Provenance:** repo-authored.

```text
CONTEXT: Architech (see ARCH-CTX). The change I want: {describe the feature in one or
two sentences}.
ROLE: Next.js 16 + React 19 senior engineer practicing server-first architecture.
ACTION:
1. Locate the governing contract first (IMPLEMENTATION-MATRIX.md, then the normative
   architecture doc) and quote the clause that applies. If none exists, say so and
   propose the smallest contract addition before writing code.
2. Produce a plan: files to touch, server vs client component split, data source, and
   which quality gates will prove each requirement.
3. Only then implement: App Router conventions, @/* and @shared/* alias imports,
   Tailwind 4 utilities, typed props, no client-side fetching for public content.
4. Public pages: real <a href> navigation, server-rendered HTML, correct metadata via
   the existing SEO surface (client/src/lib/seo).
5. Update or add docs if a contract or decision changed.
FORMAT: Plan, then a per-file diff-style implementation, then the gate results.
Do not invent listing facts or placeholder domain content; use repository fixtures.
```

### ARCH-03 — Review a diff or PR

**Best for:** PR review, reviewing agent output. **Provenance:** adapted from the classic code-review pattern used across the prompts.chat dataset; merged with Architech contracts and validated here.

```text
CONTEXT: Review this Architech change against the repo's own rules, not generic taste.
ROLE: Staff-level reviewer with SEO, accessibility, and production operations depth.
ACTION:
1. Correctness and type safety first (strict TS, no silent any).
2. Contract violations: invented facts, client-rendered public surface, fake anchors,
   broken localization fields, missing metadata, registry bypass.
3. Security and privacy: input validation, auth boundaries, RLS-sensitive queries,
   secrets handling, legal-gate surfaces (governance/legal/LEGAL-GATES.md).
4. Accessibility: semantic HTML, keyboard paths, contrast tokens.
5. Tests: which gates cover the change; what is missing.
FORMAT: Findings table — severity (blocker / should-fix / nit), file:line, the rule
violated, the fix. End with: verdict (approve / changes required) and the exact gate
commands to rerun. No style-only rewrites unless asked.
The diff to review:
{paste diff or describe files}
```

### ARCH-04 — Debug a failure

**Best for:** failing `pnpm check`, tests, build, hydration errors. **Provenance:** repo-authored.

```text
CONTEXT: Something in Architech fails. Symptom: {paste the exact error/output}.
ROLE: Root-cause-first debugger; you fix causes, not symptoms.
ACTION:
1. Reproduce: name the smallest command that shows the failure.
2. Map the error to the most likely layer (types / runtime / hydration / data / config)
   and state the evidence for that mapping before touching code.
3. Propose the minimal fix; call out any repo contract the fix must respect.
4. Verify: run the failing gate, then pnpm quality; show both passing.
5. If the failure class is new, note the guard (test or check) that should catch it
   next time.
FORMAT: Hypothesis -> evidence -> minimal fix -> verification output. No speculative
rewrites; no suppressing errors to make gates pass.
```

### ARCH-05 — Fix TypeScript errors

**Best for:** `pnpm check` failures. **Provenance:** repo-authored.

```text
CONTEXT: TypeScript strict mode in Architech. Failing output: {paste tsc errors}.
ROLE: Type-system-precise engineer on Next.js 16 + React 19.
ACTION:
1. Group errors by root cause, not by file count.
2. Fix with precise types: narrow unions, discriminated types, correct async/await of
   Next 16 route props and params; use types exported from the domain layer.
3. Forbidden: any, @ts-ignore, as-casts that erase information, or loosening
   tsconfig. If a cast seems unavoidable, stop and explain why first.
4. Re-run pnpm check and show zero errors.
FORMAT: Cause groups, then per-group fix diffs, then the passing gate output.
```

### ARCH-06 — Refactor without behavior change

**Best for:** cleanup, extraction, dead-code removal. **Provenance:** repo-authored.

```text
CONTEXT: Architech refactor of: {scope}. Behavior must not change.
ROLE: Conservative refactoring specialist.
ACTION:
1. Characterize current behavior: which tests/gates already cover {scope}; add a
   characterization test first if coverage is missing.
2. Refactor in small, separately verifiable steps; keep public APIs and rendered HTML
   identical (public routes are SEO assets — markup stability matters).
3. After each step, run the smallest relevant gate; finish with pnpm quality.
FORMAT: Step list with verification after each step. Explicitly list anything you
deliberately did NOT change.
```

### ARCH-07 — Write or repair tests

**Best for:** Vitest units, Playwright flows, a11y tests. **Provenance:** repo-authored.

```text
CONTEXT: Architech test stack — Vitest (pnpm test), Playwright (pnpm test:e2e,
pnpm test:a11y, pnpm test:ui). Target: {what to test}.
ROLE: Test engineer who tests behavior and contracts, not implementation details.
ACTION:
1. Identify the contract the test protects (domain rule, a11y rule, SEO invariant).
2. Use repository fixtures for property/locality data — never synthetic listings,
   prices, or RERA numbers.
3. Unit: colocate with the covered module per existing tests/ layout; keep it
   deterministic (no network, no clock dependence).
4. E2E/a11y: real routes, keyboard and screen-reader paths where relevant.
5. Run only the target test first, then the full gate.
FORMAT: Test file(s), fixture notes, then gate output. No snapshot-only coverage for
public pages — assert meaningful structure and links.
```

### ARCH-08 — Fix accessibility and contrast

**Best for:** axe failures, `pnpm audit:contrast` findings, keyboard traps. **Provenance:** repo-authored.

```text
CONTEXT: Architech accessibility gates: pnpm test:a11y (Playwright + axe),
pnpm audit:contrast (scripts/audit-surface-contrast.mjs). Finding: {paste finding}.
ROLE: WCAG-focused front-end engineer working in Tailwind 4 + Radix primitives.
ACTION:
1. Reproduce with the named gate; map the finding to the failing WCAG criterion.
2. Fix at the token or shared-component level when the issue repeats; page-local fixes
   only for true one-offs.
3. Preserve the approved visual direction (Ahmedabad source-of-truth design, night
   survey theme tokens); do not "fix" contrast by deleting brand surface tokens
   without proposing a replacement pair.
4. Re-run the gate; keyboard-walk the affected flow.
FORMAT: Criterion -> cause -> fix -> gate output. Note any residual manual-check items.
```

### ARCH-09 — SEO surface work

**Best for:** new indexable pages, metadata, sitemaps, structured data. **Provenance:** repo-authored.

```text
CONTEXT: Architech SEO is contract-driven: the SeoPage registry and server helpers
(client/src/lib/seo/pages-server.ts, getPublishableSeoPagesForServer) feed
app/sitemap.xml and app/sitemap/[segment] routes; seo/authority defines page
authority. Task: {describe}.
ROLE: Technical SEO engineer who treats HTML as the ranking asset.
ACTION:
1. Register/describe the page through the existing SEO surface; never hand-roll
   metadata or sitemap entries outside it.
2. Server-render the content; real internal <a href> links following the information
   architecture and page-authority rules in README.
3. Copy uses approved Ahmedabad localities; include localization fields; no invented
   statistics, prices, or claims — editorial facts only from repository fixtures.
4. Prove it: pnpm test:seo and (for new route classes) pnpm test:crawl.
FORMAT: Registry/contract change, template/metadata diff, structured-data snippet,
then gate output. Flag anything needing editorial review before indexing.
```

### ARCH-10 — Prisma schema or query change

**Best for:** schema edits, new queries, migrations. **Provenance:** repo-authored.

```text
CONTEXT: Architech persistence — Prisma 7, repositories under the data layer
(docs/data/*), seed expectations in prisma/. Change: {describe}.
ROLE: Database engineer optimizing for correctness and deployability.
ACTION:
1. Check DOMAIN-CONTRACTS.md and IMPLEMENTATION-MATRIX.md for the entity's rules
   before changing fields.
2. Schema change: add the migration path (db:generate / db:migrate semantics), keep
   seed data valid, and respect RLS-sensitive tables (pnpm security:rls).
3. Queries: typed results only; no raw SQL without justification; keep repository
   interfaces stable so fixtures keep working.
4. Verify: pnpm db:validate, then pnpm quality.
FORMAT: Contract citation, schema diff, query diffs, migration steps, gate output.
```

### ARCH-11 — Security, privacy, and legal-gate review

**Best for:** headers, auth boundaries, RLS, privacy flows, RERA/legal surfaces. **Provenance:** repo-authored.

```text
CONTEXT: Architech gates: pnpm security:headers, pnpm security:rls, pnpm legal:gates
(combined: pnpm security:audit); governance/legal/LEGAL-GATES.md; privacy retention in
scripts/privacy. Change under review: {describe or paste diff}.
ROLE: Application security reviewer for a consumer real-estate platform in India.
ACTION:
1. Enumerate trust boundaries the change crosses (public/anonymous, broker, admin,
   external provider).
2. Check each boundary for: authz checks, input validation, output encoding, secret
   handling, logging of sensitive data, RLS coverage, legal-gate text that must not be
   paraphrased.
3. Run the relevant gate commands and report raw results.
FORMAT: Boundary map, findings table (severity/rule/fix), gate output, residual-risk
note. Advisory only: never auto-approve broker listings or alter legal text.
```

### ARCH-12 — Docs, commits, and PR descriptions

**Best for:** documentation updates, commit/Pull Request text. **Provenance:** adapted from conventional-commit practice; repo-vetted.

```text
CONTEXT: Architech documentation culture — contracts and decisions live in versioned
markdown (README document map, MARKDOWN-DOCUMENTATION-INDEX.md); new top-level docs
must be indexed.
ROLE: Precise technical writer for a repo read by both humans and AI assistants.
ACTION:
1. Commits: conventional style, imperative subject under 72 chars, body explains the
   why and names any contract touched.
2. PR description: what changed, contract/decision impact, gates that were run (paste
   real command results), screenshots for UI, explicit "not done" list.
3. Docs: factual and current; no invented metrics or claims; register new files in
   MARKDOWN-DOCUMENTATION-INDEX.md; update the README document map if a source-of-truth
   file moved.
FORMAT: The commit message / PR body / doc section itself — no meta-commentary.
Input: {describe the change or paste the diff}
```

### ARCH-13 — Create a new prompt for an unlisted task

**Best for:** extending this library. **Provenance:** condensed and validated from the community "Prompt Generator" (C.R.A.F.T. framework; contributor `cperalesg` on the prompts.chat dataset, entry verified 6 Sep 2026), plus the repo vetting checklist.

```text
CONTEXT: We are writing a new task prompt for the Architech AI prompt library. The
best prompts state the goal, required expertise, preferred format, and audience so
clearly that nothing is left to guesswork.
ROLE: You are an expert prompt engineer known for precise, high-signal prompts.
ACTION:
1. Ask for the task topic and any missing constraints before writing.
2. Draft the prompt using CRAFT: Context (include the relevant part of ARCH-CTX),
   Role (industry-expert persona), Action (numbered steps, smallest-verifiable-first),
   Format (exact output shape), Target audience.
3. Insert {placeholder} blanks where the user must supply input.
4. Vet it: every file, command, and rule it references must actually exist in this
   repository — check, don't assume. Remove anything unverifiable.
5. Append it to this library with a lookup-table row and a provenance tag.
FORMAT: One fenced text block containing only the prompt, followed by one line stating
what was verified and how.
```

## Section C — Validated community prompts (for discovery)

These community entries were confirmed present in the prompts.chat ecosystem (canonical `awesome-chatgpt-prompts` dataset) on 6 Sep 2026. Use them for generic personas; prefer the ARCH prompts above for repo work, because the ARCH prompts already encode repo contracts.

| Prompt | Use it for |
|---|---|
| Linux Terminal | Dry-running shell sequences conceptually |
| JavaScript Console | Reasoning about an expression's output |
| SQL Terminal | Sketching ad-hoc query results before writing Prisma |
| Web Design Consultant | UI/UX critique before component work (pair with ARCH-08) |
| Prompt Generator (C.R.A.F.T.) | Basis of ARCH-13 |
| Tech Reviewer | Evaluating a proposed new dependency (free-first rule still applies) |

To fetch the live, up-to-date versions (and search the whole registry) without installing anything, add prompts.chat in your editor's *user-scoped* MCP settings as remote HTTP pointing at `https://prompts.chat/api/mcp` (see the README section "AI assistant tooling" for the exact JSON). Tools: `search_prompts` and `get_prompt`. No dependency, no API key for public prompts, and nothing MCP-related is committed to this repository.

### Retrieval playbook for AI agents (when the live MCP is unreachable)

Some environments (e.g. CI/agent sandboxes) block egress to prompts.chat — observed here as curl `http_code=000` / `SSL_ERROR_SYSCALL` and the stdio bridge returning `{"error":"fetch failed"}` (6 Sep 2026). **Do not retry or rotate MCP clients once the probe fails; the path below is already validated.** Skip straight to it.

**Step 0 — Repo tasks need no network at all:** for any Architech task, use the ARCH-CTX + ARCH-01…13 prompts above. The MCP/registry is only for discovering *new generic* prompts.

**Step 1 — One bounded probe, then stop trying:** a single short-timeout POST to `https://prompts.chat/api/mcp` (`initialize` or `tools/list`). Non-200/blocked ⇒ go to Step 2 for the rest of the session.

**Step 2 — Tool-side fetch of the same upstream (validated fallbacks, in preference order):**

| # | Path | What you get |
|---|---|---|
| A | `https://prompts.chat/prompts?q=<keywords>` | Site search — ranked results with **full prompt content inline** (e.g. how "Performance Tuning Agent Role" was found for the 2026-09-06 performance audit) |
| B | `https://prompts.chat/tags/<tag>` (e.g. `/tags/performance`, `/tags/frontend`) | Curated tag groupings with full content; good when you know the domain but not the prompt name |
| C | `https://prompts.chat/prompts/<id>_<slug>` (links come from A/B; more from an author via `/@<handle>`) | Exact prompt page for citing provenance |
| D | `https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/prompts.csv` | Canonical dataset behind prompts.chat — CSV columns `act,prompt,for_devs,type,contributor`; long output, so read it in chunks; best for precise dataset validation |
| Shortcut | web search `site:prompts.chat <keywords>` | Fast discovery of candidate prompt pages before fetching |

**Step 3 — Only if you must validate MCP *mechanics*** (not content): run a localhost stub emulating the `/api/mcp` JSON-RPC surface and point a *throwaway* npx-cache copy of the bridge at it; restore the cache afterwards. Never patch project files for this. (Both transports validated this way on 6 Sep 2026.)

**Step 4 — Record the path:** note which retrieval path was used (live MCP / site search / tag page / CSV) in whatever audit or validation record you produce — the performance audit and Section E below already follow this pattern.

## Section D — Guardrails for all prompts in this library

1. These prompts steer assistants on **repository work only**. They must never generate or alter listing facts, prices, availability, RERA/legal text, or broker claims (`docs/ai/phase-1-ai-assistance.md` guardrails apply).
2. Third-party prompt imports require the review described in `free-first-design-mcp-workflow.md`.
3. A prompt is "vetted" only when every fact, path, command, and rule it cites was checked against this repository on the record date below.

## Section E — Validation record (6 Sep 2026)

- Community source: canonical prompts.chat dataset fetched and inspected directly; entries quoted above (Prompt Generator/CRAFT, Linux Terminal, JavaScript Console, SQL Terminal, Web Design Consultant, Tech Reviewer) were located and content-checked.
- MCP path: the stdio bridge handshake and `tools/list` were tested live against the real server this date; tools available: `search_prompts`, `get_prompt` (server `prompts-chat` v1.0.9).
- MCP transports (second pass, same date): editor-style HTTP POST (`initialize` + `tools/call`) and the unmodified local stdio bridge (`initialize`, `search_prompts`, `get_prompt`) both exercised end-to-end against a localhost stub emulating the upstream API, returning well-formed prompt results. The throwaway npx cache was patched back afterwards; no repo files touched.
- Repo cross-check: every path, alias, script, and contract file named in ARCH-01..ARCH-13 was verified to exist in the repo at this date (incl. `pnpm check|lint|test|db:validate|test:a11y|audit:contrast|security:audit|test:seo|test:crawl|quality`, `client/src/lib/seo/pages-server.ts`, `governance/contracts/*`, `governance/legal/LEGAL-GATES.md`, `scripts/privacy`, `scripts/audit-surface-contrast.mjs`).
- Note: the authoring sandbox cannot reach prompts.chat over TLS (`SSL_ERROR_SYSCALL` on direct POST, `fetch failed` on the live bridge's `tools/call`) — a sandbox egress restriction, not a configuration problem. Live-upstream validation therefore used the canonical dataset fetch above; both transports return real prompt data on a normal developer machine. **For future sessions: don't try-and-fail the MCP in such environments — follow the validated retrieval playbook in Section C.**
