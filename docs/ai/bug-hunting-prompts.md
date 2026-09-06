# Bug-Hunting Prompts (from prompts.chat)

Retrieved 2026-09-06 from the prompts.chat catalog (the same source the `prompts.chat` MCP server configured in `.mcp.json` exposes) via search + prompt detail, selected for relevance to this repo.

How to use: paste the prompt into your AI client (Claude Code, Cursor, VS Code Copilot) with the variable filled in. For Architech, use:

- `${repositoryName}` → `Architech` (Next.js App Router, TypeScript, React, Prisma/PostgreSQL, Tailwind, Vitest, Playwright)
- `${bug}` → one-line description of the observed symptom + where (route/file)

---

## Option A — Repo-wide bug hunt (best overall)

**"Comprehensive Repository Analysis and Bug Fixing Framework"** — by [@ravidulundu](https://prompts.chat/@ravidulundu), 19 upvotes (highest-rated bug-discovery prompt in the library). Source: <https://prompts.chat/prompts/cmj5w8ysy000qrf0rzwgdwkxj_comprehensive-repository-analysis-and-bug-fixing-framework>

```text
Act as a comprehensive repository analysis and bug-fixing expert. You are tasked with conducting a thorough analysis of the entire repository to identify, prioritize, fix, and document ALL verifiable bugs, security vulnerabilities, and critical issues across any programming language, framework, or technology stack.

Your task is to:
- Perform a systematic and detailed analysis of the repository.
- Identify and categorize bugs based on severity, impact, and complexity.
- Develop a step-by-step process for fixing bugs and validating fixes.
- Document all findings and fixes for future reference.

## Phase 1: Initial Repository Assessment
You will:
1. Map the complete project structure (e.g., src/, lib/, tests/, docs/, config/, scripts/).
2. Identify the technology stack and dependencies (e.g., package.json, requirements.txt).
3. Document main entry points, critical paths, and system boundaries.
4. Analyze build configurations and CI/CD pipelines.
5. Review existing documentation (e.g., README, API docs).

## Phase 2: Systematic Bug Discovery
You will identify bugs in the following categories:
1. **Critical Bugs:** Security vulnerabilities, data corruption, crashes, etc.
2. **Functional Bugs:** Logic errors, state management issues, incorrect API contracts.
3. **Integration Bugs:** Database query errors, API usage issues, network problems.
4. **Edge Cases:** Null handling, boundary conditions, timeout issues.
5. **Code Quality Issues:** Dead code, deprecated APIs, performance bottlenecks.

### Discovery Methods:
- Static code analysis.
- Dependency vulnerability scanning.
- Code path analysis for untested code.
- Configuration validation.

## Phase 3: Bug Documentation & Prioritization
For each bug, document:
- BUG-ID, Severity, Category, File(s), Component.
- Description of current and expected behavior.
- Root cause analysis.
- Impact assessment (user/system/business).
- Reproduction steps and verification methods.
- Prioritize bugs based on severity, user impact, and complexity.

## Phase 4: Fix Implementation
1. Create an isolated branch for each fix.
2. Write a failing test first (TDD).
3. Implement minimal fixes and verify tests pass.
4. Run regression tests and update documentation.

## Phase 5: Testing & Validation
1. Provide unit, integration, and regression tests for each fix.
2. Validate fixes using comprehensive test structures.
3. Run static analysis and verify performance benchmarks.

## Phase 6: Documentation & Reporting
1. Update inline code comments and API documentation.
2. Create an executive summary report with findings and fixes.
3. Deliver results in Markdown, JSON/YAML, and CSV formats.

## Phase 7: Continuous Improvement
1. Identify common bug patterns and recommend preventive measures.
2. Propose enhancements to tools, processes, and architecture.
3. Suggest monitoring and logging improvements.

## Constraints:
- Never compromise security for simplicity.
- Maintain an audit trail of changes.
- Follow semantic versioning for API changes.
- Document assumptions and respect rate limits.

Use variables like repositoryName for repository-specific details. Provide detailed documentation and code examples when necessary.
```

### Architech-specific usage notes (add after the prompt, optional)

```text
repositoryName: Architech

Scope (start here, then widen): public search/listing/filter flows in app/,
Prisma/PostgreSQL query code, booking and payment-adjacent flows, and SEO
route rendering. Validate with the repo's own tooling: pnpm test (Vitest),
pnpm check (tsc), pnpm lint, Playwright route checks (pnpm test:a11y /
pnpm test:ui). Never invent listing facts, prices, RERA claims, or locality
statistics — flag them as evidence gaps instead (repo policy, see
free-first-design-mcp-workflow.md).
```

---

## Option B — Single bug report (reproduce → fix protocol)

**"Test-Driven Bug Hunting With Reproduction Agents"** — by [@ilker](https://prompts.chat/@ilker). Source: <https://prompts.chat/prompts/cmpb3zajb0001jm04te3gbgin_test-driven-bug-hunting-with-reproduction-agents>

```text
Bug report: <bug>. Follow this strict protocol: PHASE 1 (Reproduce): Write mock-based failing tests that reproduce the exact reported scenario—do not edit any production code yet. Show me the failing test output. PHASE 2 (Hypothesize): List every plausible root cause ranked by likelihood, with evidence from the codebase via Grep/Read. PHASE 3 (Parallel Fix): Spawn one sub-agent per top-3 hypothesis via the Task tool; each agent fixes its hypothesis on a separate git worktree/branch and reports whether the failing test now passes plus whether the full suite stays green. PHASE 4 (Synthesize): Recommend which fix to merge and why, then commit. Refuse to skip phases.
```

(Replace `<bug>` with the symptom, e.g. "filter results drop when locality is cleared on /search".)

---

## Why these two

- **Option A** is the community's highest-voted bug-discovery prompt (19 upvotes) and is built exactly for "scan our repo for bugs" — its 7 phases (assess → discover → document → fix → validate → report → improve) line up with this repo's audit-heavy workflow (`CODEBASE-AUDIT-*.md`, security audits in `scripts/security/`).
- **Option B** is the focused companion for a *known* bug: it forces reproduction via a failing test before any code change, which matches the repo's Vitest/Playwright setup and TDD conventions.
- Everything else surfaced by search (code-review meta-prompts, generic "master prompt" posts) was either sponsored ads, off-topic, or lower-voted.
