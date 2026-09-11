# scripts/ — Build, tooling, and audit scripts

Plain `.mjs` files, stdlib-first (`node:fs`, `node:path`) so audits run without
dependencies. Invoked from `package.json` scripts — **moving a file here breaks
npm scripts; update `package.json` in the same change.**

## Layout

- Root: `build-ci.mjs`, `build-publish.mjs`, `materialize-static-publish.mjs`,
  `publish-server.mjs`, `generate-md-index.mjs`, `audit-surface-contrast.mjs`
- `operations/` — env/secrets/provisioning/readiness audits (read `config/governance/`)
- `security/` — header, RLS, and legal-gate audits
- `release/` — release + production-enablement audits (read `config/governance/release/`)
- `seo/` — search-console audit, crawl simulation, SEO suites (read `config/seo/`)
- `performance/` — perf budget enforcement (reads `config/performance/budgets.json`)
- `location/` — India Post / LGD fetch+import pipelines (read/write `config/data/location/`)
- `privacy/` — lead/requirement purge jobs (+ `*.test.mjs`, run with `node --test`)
- `auth/`, `data/`, `audit/`, `sandbox/` — auth tooling, data prep, surface audits, local DB setup

## Rules

- Scripts that validate configuration read from `config/` — keep paths in sync with
  that tree (see `config/AGENTS.md`).
- Test scripts in this folder use the Node test runner (`node --test`), not vitest.
- `generate-md-index.mjs` regenerates `docs/MARKDOWN-DOCUMENTATION-INDEX.md` —
  rerun it after adding/moving any markdown file.

## See also

Root `AGENTS.md` for the command list; `config/AGENTS.md` for the contracts these read.
