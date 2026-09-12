# ops/scripts/ — Build, tooling, and audit scripts

Plain `.mjs` files, stdlib-first (`node:fs`, `node:path`) so audits run without
dependencies. Invoked from `package.json` scripts — **moving a file here breaks
npm scripts; update `package.json` in the same change.**

## Layout

- Root: `verify.mjs` (whole local gate, CI parity minus build/browser),
  `build-ci.mjs`, `build-publish.mjs`, `materialize-static-publish.mjs`,
  `publish-server.mjs`, `generate-md-index.mjs`, `audit-surface-contrast.mjs`
- `operations/` — env/secrets/provisioning/readiness audits (read `ops/config/governance/`)
- `security/` — header, RLS, and legal-gate audits
- `release/` — release + production-enablement audits (read `ops/config/governance/release/`)
- `seo/` — search-console audit, crawl simulation, SEO suites (read `ops/config/seo/`)
- `performance/` — perf budget enforcement (reads `ops/config/performance/budgets.json`)
- `location/` — India Post / LGD fetch+import pipelines (read/write `ops/config/data/location/`)
- `privacy/` — lead/requirement purge jobs (+ `*.test.mjs`, run with `node --test`)
- `auth/`, `data/`, `audit/`, `sandbox/` — auth tooling, data prep, surface audits, local DB setup,
  baseline worktree provisioning (`baseline-worktree.mjs`)

## Rules

- Scripts that validate configuration read from `ops/config/` — keep paths in sync
  with that tree (see `../config/AGENTS.md`).
- Test scripts in this folder use the Node test runner (`node --test`), not vitest.
  `pnpm ops:test` runs all of them; the glob in `package.json` **must stay
  quoted** — unquoted, `sh` expands `**` as `*` and silently skips test files
  sitting directly under `ops/scripts/`. `ops/scripts/verify.test.mjs` asserts
  the glob still reaches every file on disk.
- Before adding a suite here, confirm it is reachable from `pnpm ops:test`, and
  decide whether it belongs in `verify.mjs`'s `CHECKS` list too. A script that
  nothing runs is how the ops suites went unrun in CI in the first place.
- `generate-md-index.mjs` regenerates `docs/MARKDOWN-DOCUMENTATION-INDEX.md` —
  rerun it after adding/moving any markdown file. CI enforces this, so its output
  must stay deterministic: do not reintroduce a timestamp into the generated file.

## Gotchas

**Never symlink `node_modules` into a git worktree.** Next.js 16 builds with
Turbopack, which resolves the project root to the worktree and panics on a link
pointing outside it:

```
Symlink [project]/node_modules is invalid, it points out of the filesystem root
```

The knock-on error is misleading — `ops/scripts/performance/budget.mjs` then
reports `Missing .next diagnostics`, which looks like a broken script. Run a real
`pnpm install --frozen-lockfile` in the worktree instead; with a warm store it
takes seconds. `pnpm baseline:worktree` does this correctly:

```bash
pnpm baseline:worktree                        # provision at origin/main
pnpm baseline:worktree -- --script test:perf  # run a check in both, compare
pnpm baseline:worktree -- --remove            # clean up
```

Use it before blaming a branch for a red check — several audits have been red on
`main` independently of the change under review.

## See also

Root `AGENTS.md` for the command list; `../config/AGENTS.md` for the contracts these read.
