# Repository Restructure — Canonical `src/` Layout

**Date:** 2026-09-10
**Status:** Approved design (pending implementation)
**Author:** Arena Agent (architect role)
**Scope:** Reorganize the Architech repo root so (a) the directory layout is a standard, well-designed Next.js structure and (b) agents resolve code from a single `src/` folder instead of scanning the root.

## Context & problem

The repo root currently contains 9 top-level source folders:

- `app/` (144 files) — Next.js App Router routes/pages/API
- `client/` (501 files) — all React code under `client/src/`
- `shared/` (1 file) — cross-boundary constants
- `prisma/` (23) — schema, migrations, seeds
- `scripts/` (50) — build/CI/audit/data pipelines
- `config/` (19) — machine-readable operational contracts
- `docs/` (186) — human documentation
- `tests/` (11) — Playwright a11y/ui/e2e
- `public/` (30) — static assets (framework-locked)

Code is split across three folders (`app/`, `client/src/`, `shared/`), and the `@/` alias points at `./client/src/*`. Agents therefore cannot "check the code folder first" — there is no single code folder. The goal is to collapse all application code into one canonical `src/` directory and slim the support folders, while leaving Next.js-framework-locked files in place.

## Target layout

```
src/                    # ALL application code (single entry point for agents)
  app/                  # routes/pages/API handlers, sitemaps, metadata  (was app/)
  components/ hooks/ contexts/ lib/ pages/ stories/ test/ theme.css     (was client/src/)
  shared/               # cross-boundary constants                        (was shared/)
  AGENTS.md             # navigation map for everything under src/
db/                     # Prisma schema, migrations, seeds               (was prisma/)
ops/                    # operational tooling + contracts
  scripts/              # build/CI/audit/data pipelines                   (was scripts/)
  config/               # JSON contracts + governance                      (was config/)
docs/                   # documentation (unchanged)
tests/                  # Playwright a11y/ui/e2e (unchanged)
public/                 # static assets (framework-locked, unchanged)
+ framework-required root files (unchanged)
```

Root folder count: **9 → 6**.

## Explicitly NOT moved (framework-locked)

Per the existing root `AGENTS.md`, the following stay at the repository root because Next.js/Prisma/Vite/Storybook require them there, or they are hidden dotfolders:

- `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `postcss.config.mjs`, `components.json`, `eslint.config.js`
- `proxy.ts` (Next 16 middleware), `instrumentation.ts`, `instrumentation-client.ts`
- `sentry.client.config.ts`, `sentry.server.config.ts`
- `vitest.config.ts`, `playwright.a11y.config.ts`, `playwright.a11y.broker.config.ts`, `playwright.ui.config.ts`
- `prisma.config.ts` (auto-detected by Prisma CLI at root)
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `.env.example`, `.env.staging.example`, `.env.production.example`
- `vercel.json`, `railway.json`, `docker-compose.production-like.yml`
- `.gitignore`, `.gitkeep`, `.prettierignore`, `.prettierrc`, `.mcp.json`, `README.md`, `AGENTS.md`
- `.github/`, `.storybook/`, `.cursor/`, `.skills/` (dotfolders)

`public/` stays at root (Next.js convention; also referenced by Storybook `staticDirs` and `next.config.ts`'s MapLibre vendor copy).

## Move plan (all `git mv`)

1. `app/*` → `src/app/*`
2. `client/src/*` → `src/*`
3. `shared/*` → `src/shared/*`
4. `prisma/*` → `db/*`
5. `scripts/*` → `ops/scripts/*`
6. `config/*` → `ops/config/*`
7. `client/public/images/*` → `public/images/*` (only after confirming no reference to `client/public`)
8. `client/AGENTS.md` → `src/AGENTS.md` (consolidated with `app/AGENTS.md`)
9. `scripts/AGENTS.md` → `ops/scripts/AGENTS.md`
10. `config/AGENTS.md` → `ops/config/AGENTS.md`
11. Remove the now-empty `client/` directory.

## Config / reference edits

Source imports use the `@/` and `@shared/` aliases and therefore **do not change**. Only alias targets and literal path strings change.

| File | Change |
|---|---|
| `tsconfig.json` | `paths`: `@/*` → `./src/*`, `@shared/*` → `./src/shared/*`; `include` globs `app/**`, `client/src/**`, `shared/**` → `src/**` |
| `next.config.ts` | `loaderFile: "./client/src/lib/media/next-image-loader.ts"` → `./src/lib/media/next-image-loader.ts` (+ comment references) |
| `instrumentation.ts` | 4 dynamic imports `./client/src/lib/{seo,saved-search,leads,media}/...` → `./src/lib/...` |
| `vitest.config.ts` | `include` `client/src/**/*.test.ts` → `src/**/*.test.ts`; aliases `client/src` → `src`, `shared` → `src/shared`; `server-only` stub `client/src/test/...` → `src/test/...` |
| `.storybook/main.ts` | `stories` glob `../client/src/**` → `../src/**`; aliases `../client/src` → `../src`, `../shared` → `../src/shared` |
| `eslint.config.js` | `files` `client/src/**`, `shared/**` → `src/**`; `app/**` → `src/app/**`; ignore `client/src/components/ui/**` → `src/components/ui/**`; drop stale `server/**` |
| `components.json` | `"css": "client/src/index.css"` → `"src/theme.css"` (fixes a stale path: `index.css` does not exist; `theme.css` does) |
| `package.json` | `lint`: `eslint app client/src` → `eslint src`; every `scripts/…` path in scripts → `ops/scripts/…` |
| `prisma.config.ts` | `schema` → `db/schema.prisma`, `migrations.path` → `db/migrations`, `seed` → `node db/seed.mjs` |
| `scripts/**` (~9 files) | Any literal `client/src`, `app/`, `scripts/`, `config/` path strings updated |
| `docs/**` | Update `docs/AGENTS.md`, root `AGENTS.md`, and `MARKDOWN-DOCUMENTATION-INDEX.md` references to old paths |
| `.gitignore` | Adjust any `client/`/`scripts/`/`config/` entries |

Root `AGENTS.md` is rewritten for the new map (single `src/` code folder, updated routing tables).

## Verification (after each incremental commit)

1. `pnpm check` — `tsc --noEmit` (mandatory after any move/rename per AGENTS.md)
2. `pnpm lint`
3. `pnpm test` — vitest unit tests
4. `pnpm db:validate` — `prisma validate`
5. `pnpm build` — full production build (final confidence gate)
6. Optionally `pnpm test:seo` / `pnpm test:e2e` (require build)

## Rollback

All changes are `git mv` on the session branch, committed incrementally. Any single step can be reverted with `git revert <step>`; the whole change with `git revert` of the sequence or a reset to the pre-migration commit.

## Risks & mitigations

- **Missed path reference** → breakage caught by `pnpm check`/`pnpm build`; fixed inline before final commit.
- **Tailwind 4 source detection** → Tailwind 4 auto-detects sources from the workspace; `theme.css` uses `@import "tailwindcss"`. Confirmed no `tailwind.config.js`/`@source` exclusions to update.
- **`client/public/images`** → verified for references before folding into `public/images/`; if referenced, kept in place.
- **Prisma engine path** → `prisma.config.ts` is the single source of truth for schema/migrations/seed; updated atomically.
