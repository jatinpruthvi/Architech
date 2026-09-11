# Repository Restructure — Implementation Plan

**Date:** 2026-09-11 · **Design:** `docs/superpowers/specs/2026-09-11-repository-restructure-design.md`
**Branch:** `arena/01a08e87-architech` · All moves via `git mv`.

## Task 1 — Rehome machine config under `config/` (code paths)

- [ ] 1.1 `git mv governance config/governance`
- [ ] 1.2 `git mv data config/data` (contains only `location/`)
- [ ] 1.3 `git mv performance config/performance`
- [ ] 1.4 `mkdir config/seo && git mv seo/monitoring/search-console.config.json config/seo/`
- [ ] 1.5 Update path constants in 7 scripts (operations ×4, release ×2, security ×1)
- [ ] 1.6 Update 4 client tests reading governance JSON
- [ ] 1.7 Update `india-states.ts`, `india-state-mapping.test.ts`, `india-state-registry.mjs`
- [ ] 1.8 Update `budget.mjs`, `search-console-audit.mjs`, gates JSON evidence path, `llms.ts` comment
- [ ] 1.9 Verify: `pnpm install && pnpm check && pnpm test` + run audit scripts
- [ ] 1.10 Commit: `chore: rehome operational config under config/`

## Task 2 — Consolidate human docs under `docs/` (no code paths)

- [ ] 2.1 Move `history/ → docs/history/`, `planning/ → docs/planning/`, `architecture/normative → docs/architecture/normative/`
- [ ] 2.2 Move `seo/{authority,execution}/*.md → docs/seo/…`; remove empty `seo/`
- [ ] 2.3 Move 32 root md files per disposition map; `template.json → docs/archive/`; rename the spaced India-Post file
- [ ] 2.4 Update `generate-md-index.mjs` (categories, output to `docs/`); regenerate index
- [ ] 2.5 Update `ARCHIVE_INDEX.md` paths, `README.md` links, grep-fix docs cross-links
- [ ] 2.6 Verify: no stale root refs in active docs; `git status` clean
- [ ] 2.7 Commit: `docs: consolidate all documentation under docs/`

## Task 3 — AGENTS.md navigation system

- [ ] 3.1 Root `AGENTS.md`: routing table, dir map, locked files, aliases, commands, new-file matrix, docs order
- [ ] 3.2 Nested `AGENTS.md` × 6: `app/`, `client/`, `scripts/`, `tests/`, `docs/`, `config/`
- [ ] 3.3 Commit: `docs: add AGENTS.md navigation system`

## Task 4 — README + final sweep

- [ ] 4.1 Update README document map to new structure
- [ ] 4.2 Final grep sweep + full verification rerun
- [ ] 4.3 Commit: `docs: update README document map`

## Verification gates

After each task: `pnpm check`, `pnpm test`, targeted audit scripts, stale-ref grep.
Final: everything rerun clean, working tree clean.
