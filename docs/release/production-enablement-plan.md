# Production Enablement Plan After Phase 1

**Date:** 24 Aug 2026  
**Status:** Planning contract — not production approval.

Phase 1 is now a validated prototype foundation. This plan defines how to move from validated contracts to production-backed services without accidentally enabling incomplete legal, data, security, or operational surfaces.

## Environments

The machine-readable plan is:

```text
governance/release/production-enablement-plan.json
```

Required environments:

1. **Preview** — per-PR validation and stakeholder review.
2. **Staging** — production-like migrations, restore drills, integration tests, legal evidence.
3. **Production** — public launch only after every required approval/evidence gate passes.

## Adapter switches

The current app intentionally has contract or fixture implementations for several systems. Production enablement must switch these behind stable interfaces:

| Area | From | To |
|---|---|---|
| Repositories | fixture repositories | Prisma-backed repositories |
| Search | fixture search service | PostgreSQL FTS/trigram |
| Leads | in-memory lead API | Prisma transaction + notification queue |
| Auth | demo Better Auth contract | live Better Auth sessions + org memberships |
| Media | upload contract | R2/Stream signed uploads + derivative workers |
| RERA | demo adapter | approved Gujarat RERA source adapter |
| Observability | local logger/RUM contracts | Sentry/log drain dashboards and alerts |

## Launch gate rule

Production launch is blocked until:

- all required secrets are in platform secret stores,
- no token/credential is stored in source control,
- staging DB migration and restore drill pass,
- legal gates `LEG-001` through `LEG-009` are approved or the relevant feature is explicitly disabled,
- Search Console is verified,
- Sentry/logging dashboards and alert routes exist,
- rollback procedure is tested,
- the full launch command set passes.

## Command gate

```bash
pnpm check
pnpm lint
pnpm test
pnpm db:validate
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm production:plan:audit
pnpm build
pnpm test:perf
pnpm test:seo
pnpm test:a11y
```

## Recommended next engineering order

1. Create Vercel preview/staging/production projects.
2. Provision Railway PostgreSQL/PostGIS and Redis staging.
3. Deploy migrations to staging and run seed/smoke tests.
4. Switch repository/search read paths to Prisma in staging.
5. Enable Better Auth live sessions and broker memberships.
6. Connect lead persistence and notification queue.
7. Connect R2/Stream media pipeline.
8. Replace demo RERA adapter after legal/source approval.
9. Provision Sentry/log drain dashboards and alert tests.
10. Complete legal approvals and final launch report.
