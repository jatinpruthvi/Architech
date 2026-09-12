# AGENTS.md — Repository Navigation Map

**Architech** — India real-estate discovery platform. Next.js 16 (App Router) · React 19 · TypeScript strict · Prisma 7 + PostGIS · Tailwind 4 · pnpm.

## The golden rule

**Do not grep from the repository root.** Route yourself with the tables below, `cd` into
the area you are changing, and read that area's `AGENTS.md` first. Every major directory
has one. For documentation questions, search inside `docs/` — never at the root.

All application code lives under **`src/`** — check there first, before the repository root.

## Repository map

| Directory | What lives there | Go here when… |
|---|---|---|
| `src/` | **ALL application code**: `src/app/` (routes), components, hooks, contexts, `lib/` (business logic), `shared/` | Changing any page, route, API, component, client logic, style, or shared constant |
| `db/` | `schema.prisma`, migrations, seeds | Changing the database |
| `ops/scripts/` | Build, CI, audits, data pipelines (plain `.mjs`, stdlib-first) | Changing build, tooling, audit or import scripts |
| `ops/config/` | Machine-readable operational contracts (read by scripts/tests) | Env matrices, secret inventory, budgets, release/legal evidence |
| `tests/` | Playwright (a11y, ui, a11y-broker) + real-HTTP e2e suites | Adding/changing browser or e2e tests |
| `public/` | Static assets, fonts-derived icons, vendored MapLibre | Adding static files |
| `docs/` | **All human documentation** (100+ files, categorized) | Any question that isn't code |

## Task → folder routing

| I need to… | Go to |
|---|---|
| Change a page/route UI | `src/app/<route>/` → then `src/` for components/logic |
| Add/modify an API endpoint | `src/app/api/` |
| Add a UI component | `src/components/` (`ui/` = shadcn primitives, `architech/` = product components) |
| Change business logic / data shaping | `src/lib/<domain>/` (leads, listing, seo, broker, governance, …) |
| Change styling / theme tokens | `src/theme.css` + `src/components/ui/` |
| Change the database schema | `db/schema.prisma` + `prisma migrate` |
| Add an npm script / audit | `package.json` + `ops/scripts/<domain>/` |
| Add a unit test | Colocate: `src/**/*.test.ts` (vitest) |
| Add e2e / a11y / UI test | `tests/e2e/`, `tests/a11y/`, `tests/ui/` |
| Find env/secrets/release/legal contracts | `ops/config/governance/` |
| Find performance budgets | `ops/config/performance/budgets.json` |
| Find SEO monitoring config | `ops/config/seo/search-console.config.json` |
| Find reference datasets (LGD, India Post) | `ops/config/data/location/` |
| Find design/architecture decisions | `docs/architecture/`, `ops/config/governance/decisions/` |
| Find current status & plans | `docs/planning/` (STATUS.md, PHASE-1-IMPLEMENTATION-PLAN.md) |
| Find past audits / debugging findings | `docs/audits/`, `docs/findings/` |

## Documentation search order

1. This file's routing table (above)
2. `docs/MARKDOWN-DOCUMENTATION-INDEX.md` — generated index of every doc, categorized
3. The matching `docs/` subdirectory (`planning/`, `architecture/`, `audits/`, `findings/`, `research/`, `product/`, `ui/`, `seo/`, `data/`, `guides/`, `history/`, `archive/`, …)
4. Only then a repo-wide grep — and never before checking `docs/history/` is the right place to look

## Framework-locked root files — do NOT move

`public/` (Next.js convention) · `proxy.ts` (Next 16 middleware) ·
`instrumentation.ts`, `instrumentation-client.ts` · `next.config.ts` ·
`sentry.client.config.ts`, `sentry.server.config.ts` · `tsconfig.json` ·
`eslint.config.js` · `postcss.config.mjs` · `vitest.config.ts` ·
`playwright.a11y.config.ts`, `playwright.a11y.broker.config.ts`, `playwright.ui.config.ts` ·
`prisma.config.ts` · `components.json` (shadcn) · `package.json`, `pnpm-*` ·
`.env*.example`, `vercel.json`, `railway.json`, `docker-compose.production-like.yml`

Note: `src/app/` and `public/` are the two directories Next.js resolves by convention;
everything else under `src/` is application code moved from the former `client/src/`.

## Import aliases

- `@/…` → `src/…`
- `@shared/…` → `src/shared/…`
- JSON snapshots under `ops/config/data/` are imported with **relative paths** from
  `src/lib/` — keep them stable.

## Commands

```bash
pnpm dev            # dev server (0.0.0.0:3000)
pnpm check          # tsc --noEmit          ← run after any move/rename
pnpm lint           # eslint src
pnpm test           # vitest (unit, colocated)
pnpm quality        # check + lint + test + db:validate
pnpm verify         # the full local gate, CI parity minus build/browser — run this before pushing
pnpm build          # production build via ops/scripts/build-publish.mjs
pnpm test:seo       # no-JS SEO smoke suite
pnpm test:e2e       # e2e (needs build)
pnpm test:a11y      # playwright a11y
```

Operational audits (stdlib-only, safe to run anytime): `pnpm env:audit`,
`pnpm secrets:audit`, `pnpm ops:audit`, `pnpm release:audit`, `pnpm legal:gates`,
`pnpm security:audit`, `pnpm seo:gsc:audit`, `pnpm location:coverage:audit`.

### `quality` vs `verify`

`pnpm quality` is `check + lint + test + db:validate`. That is a **subset** of
what CI enforces — it skips the ops Node test suites and every governance audit,
so green there does not mean green on the PR.

`pnpm verify` runs the whole local gate: everything CI does that needs neither a
production build nor a browser, plus the docs-index freshness check. It continues
past failures and prints one summary, so a broken tree costs one run to diagnose
rather than one round trip per problem.

```bash
pnpm verify                    # everything
pnpm verify -- --quick         # check, lint, ops:test, test
pnpm verify -- --only lint,docs-index
pnpm verify -- --list
```

Also worth knowing:

- `pnpm docs:index` regenerates `docs/MARKDOWN-DOCUMENTATION-INDEX.md`. CI fails
  if it is stale, so run it after adding or moving any markdown file.
- `pnpm ops:test` runs every `ops/scripts/**/*.test.mjs` under the Node test
  runner. `pnpm test` is vitest and does not reach them. The glob must stay
  quoted in `package.json` — unquoted, `sh` expands `**` as `*` and silently
  skips test files directly under `ops/scripts/`.
- `pnpm baseline:worktree` provisions a checkout of `origin/main` to answer "is
  this failure mine?" See `ops/scripts/AGENTS.md` before improvising a worktree.
- `pnpm security:rls:proof` and `pnpm security:channel:proof` prove the RLS and
  broker-channel constraints against a **real** PostgreSQL as a non-superuser.
  They are not part of `pnpm test`; run them before changing those migrations.

`next-env.d.ts` is generated by Next.js and flips between `.next/dev/types/...`
and `.next/types/...` depending on whether the last command was `dev` or `build`.
Keep that churn out of commits.

## Where new files go

| New artifact | Location |
|---|---|
| Route/page | `src/app/<route>/page.tsx` (+ `src/` for heavy client code) |
| Component | `src/components/<area>/` |
| Domain logic | `src/lib/<domain>/` (+ colocated `.test.ts`) |
| Script | `ops/scripts/<domain>/` (match existing stdlib style) |
| Document | `docs/<category>/` — see `docs/AGENTS.md` |
| Config contract (JSON read by tooling) | `ops/config/<area>/` — see `ops/config/AGENTS.md` |
| Storybook story | `src/stories/` |

## Nested AGENTS.md

`src/AGENTS.md` · `src/app/AGENTS.md` · `ops/scripts/AGENTS.md` ·
`ops/config/AGENTS.md` · `tests/AGENTS.md` · `docs/AGENTS.md` — read the one for
the area you're touching.
