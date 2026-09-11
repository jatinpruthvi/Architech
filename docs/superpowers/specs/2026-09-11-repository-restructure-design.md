# Repository Restructure — Design

**Date:** 2026-09-11
**Status:** Approved
**Scope:** Aggressive — consolidate all human docs under `docs/`, rehome all machine-readable operational config under `config/`, add an AGENTS.md navigation system.

## Problem

The repository root has ~60 entries: 32 loose markdown files, four docs-only directories
(`history/`, `planning/`, `architecture/`, most of `seo/`), and four machine-config
directories (`governance/`, `data/`, `performance/`, `seo/monitoring/`) sitting
interchangeably with framework-locked files. Agents and humans cannot tell code from
contracts from prose without grepping from the root.

## Goals

1. Root communicates structure at a glance: code dirs, `config/`, `docs/`, lock-files.
2. Agents route to the right folder first (AGENTS.md map) instead of searching the root.
3. No code-path regressions: every consumer of moved files is updated and verified.
4. History preserved: all moves via `git mv`.

## Non-goals

- Moving framework-locked files (`app/`, `public/`, `proxy.ts`, `instrumentation*.ts`,
  `next.config.ts`, tsconfig/eslint/postcss/vitest/playwright/sentry configs, `prisma/`,
  `client/`, `shared/`, `scripts/`, `tests/`, env examples, deploy manifests).
- Renaming documents (only relocation; filenames stay grep-able).

## Target structure

```
Architech/
├── AGENTS.md                    master agent navigation map
├── README.md                    project source of truth (updated map)
├── app/  client/  shared/  scripts/  tests/  prisma/  public/   (code — unchanged)
├── config/                      machine-readable operational config
│   ├── governance/              ← governance/     (contracts, env, secrets, release, legal)
│   ├── data/location/           ← data/location   (LGD / India Post snapshots)
│   ├── performance/             ← performance/    (budgets.json)
│   └── seo/                     ← seo/monitoring/ (search-console.config.json)
├── docs/                        all human documentation
│   ├── architecture/normative/  ← architecture/normative/
│   ├── history/                 ← history/ (recommendations, reviews, appendices)
│   ├── planning/                ← planning/ + root todo/blocker/ideas/status/phase-1 plan
│   ├── specs/                   ← filter-rebuild-spec.md
│   ├── audits/ (＋ 2026-08/)    ← all audit docs
│   ├── findings/                ← *-findings.md, theme-contrast-findings.md
│   ├── research/                ← awesome-real-estate-*, best-real-estate-*, open-source-*
│   ├── product/                 ← addressbox-* inventories
│   ├── ui/                      ← NIGHT-SURVEY-THEME.md
│   ├── data/                    ← hozn-*.md, India Post/LGD resource IDs
│   ├── seo/authority|execution/ ← seo/*.md
│   ├── guides/                  ← free-first-design-mcp-workflow.md
│   ├── archive/                 ← ARCHIVE_INDEX.md, template.json
│   └── MARKDOWN-DOCUMENTATION-INDEX.md   (regenerated here)
└── (framework-locked root config files, unchanged)
```

## Disposition map (root markdown)

| File | New location |
|---|---|
| STATUS.md | docs/planning/STATUS.md |
| todo.md | docs/planning/todo.md |
| blocker.md | docs/planning/blocker.md |
| ideas.md | docs/planning/ideas.md |
| PHASE-1-IMPLEMENTATION-PLAN.md | docs/planning/PHASE-1-IMPLEMENTATION-PLAN.md |
| filter-rebuild-spec.md | docs/specs/filter-rebuild-spec.md |
| free-first-design-mcp-workflow.md | docs/guides/free-first-design-mcp-workflow.md |
| CODEBASE-AUDIT-2026-08-30.md | docs/audits/2026-08/ |
| design-audit-2026-08-28.md | docs/audits/2026-08/ |
| design-interaction-improvements-2026-08-28.md | docs/audits/2026-08/ |
| REPOSITORY-IMPROVEMENT-AUDIT.md | docs/audits/ |
| IMPROVEMENT-REVIEW.md / -2.md | docs/audits/ |
| non-payment-functionality-audit.md | docs/audits/ |
| online-booking-ui-audit.md | docs/audits/ |
| browser-findings.md, hero-search-findings.md, hydration-fix-findings.md, theme-contrast-findings.md | docs/findings/ |
| awesome-real-estate-audit-notes.md, awesome-real-estate-recommendation.md, best-real-estate-github-repository.md, open-source-asset-research.md | docs/research/ |
| addressbox-agent-inventory.md, addressbox-feature-inventory.md, addressbox-feature-map.md | docs/product/ |
| NIGHT-SURVEY-THEME.md | docs/ui/ |
| hozn-adaptation-strategy.md, hozn-property-field-mapping.md, official India Post and LGD resource IDs and URLs todo.md | docs/data/ (last one renamed: official-india-post-lgd-resource-ids.md — spaces in filename) |
| ARCHIVE_INDEX.md | docs/archive/ARCHIVE_INDEX.md |
| template.json | docs/archive/template.json (scaffolding leftover, referenced nowhere) |
| MARKDOWN-DOCUMENTATION-INDEX.md | regenerated at docs/ by updated generator |

## Reference updates

- `scripts/operations/{environment,provisioning-smoke,readiness,secrets}-audit.mjs` → `config/governance/…`
- `scripts/release/{phase-1-release-audit,production-enablement-audit}.mjs` → `config/governance/…`
- `scripts/security/legal-gate-audit.mjs` → `config/governance/…`
- `client/src/lib/operations/{environment,readiness}.test.ts`, `client/src/lib/release/{release,production-enablement}.test.ts` → `config/governance/…`
- `client/src/lib/location/india-states.ts`, `client/src/lib/interop/india-state-mapping.test.ts`, `scripts/location/india-state-registry.mjs` → `config/data/location/…`
- `scripts/performance/budget.mjs` → `config/performance/budgets.json`
- `scripts/seo/search-console-audit.mjs` → `config/seo/search-console.config.json`
- `config/governance/legal/gates/phase-1-gates.json` evidence path → `docs/seo/authority/…`
- `client/src/lib/seo/llms.ts` comment → `docs/architecture/normative/…`
- `scripts/generate-md-index.mjs` → new categories + output `docs/MARKDOWN-DOCUMENTATION-INDEX.md`
- `README.md`, `ARCHIVE_INDEX.md`, docs cross-links → path fixes (grep-driven)

## AGENTS.md system

- Root `AGENTS.md`: golden rule (route, don't root-grep), directory map, task→folder
  routing table, framework-locked do-not-move list, aliases, commands, new-file matrix,
  docs search order.
- Nested `AGENTS.md` in `app/`, `client/`, `scripts/`, `tests/`, `docs/`, `config/`.

## Verification

1. `pnpm install`; `pnpm check` (tsc resolves moved JSON imports); `pnpm test` (vitest runs
   tests that read config/governance + config/data files).
2. Stdlib-only audits: env:audit, secrets:audit, ops:audit, release:audit,
   production:plan:audit, legal:gates, seo:gsc:audit, location:coverage:audit.
3. `node scripts/generate-md-index.mjs`; grep for stale `governance/|data/|seo/|history/|planning/|architecture/` references in code.
4. Full-repo grep sweep; git status clean; logical commits per task.

## Risks / residual

- e2e/crawl suites need a built app + DB — covered indirectly: tsc + vitest exercise every
  moved path consumers; audit scripts are the runtime readers of config/.
- Historical documents may reference old sibling paths inside their prose; archive-facing
  links (ARCHIVE_INDEX, README) are updated, in-prose references left as historical record.
