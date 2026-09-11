# tests/ — Browser and end-to-end suites

Playwright-driven suites that run against a **built** app (`pnpm build:ci` first).
Unit tests do NOT live here — they are colocated in `client/src/**/*.test.ts`.

## Layout

- `e2e/` — real-HTTP end-to-end flows (`run-all.mjs` orchestrator; auth flows,
  public routes, URL grammar, SEO plumbing, security headers)
- `a11y/` — accessibility suite (`playwright.a11y.config.ts`)
- `a11y-broker/` — broker-surface a11y suite (`playwright.a11y.broker.config.ts`)
- `ui/` — UI interaction suite (`playwright.ui.config.ts`)

## Commands

```bash
pnpm test:e2e        # build + run all e2e
pnpm test:a11y       # playwright a11y
pnpm test:a11y:broker
pnpm test:ui
```

## See also

Root `AGENTS.md` for environment prerequisites (PostGIS via
`docker-compose.production-like.yml`, env files from `.env*.example`).
