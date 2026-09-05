# Production Environment Provisioning Runbook

**Date:** 24 Aug 2026  
**Status:** ready to execute when account access and secrets are available.

This runbook is the next step after the Phase 1 release report. It does not contain secret values.

## Required accounts

- GitHub repository admin access
- Vercel team/project access
- Railway project access
- Cloudflare account for R2/Stream
- Sentry organization/project access
- Resend account access
- Google Search Console domain verification access
- DNS/registrar access

## Environment order

1. Preview
2. Staging
3. Production

Do not create production before staging passes migrations, smoke tests, restore drill, and legal gate review.

## Preview

- Create/import Vercel project from GitHub.
- Set `NEXT_PUBLIC_SITE_URL` to preview URL or canonical preview base.
- Confirm PR preview builds.
- Confirm iframe/preview headers work.

## Staging

- Create staging Vercel project/environment.
- Provision Railway PostgreSQL/PostGIS.
- Provision Railway Redis.
- Create Sentry staging project.
- Create R2 staging bucket.
- Create Resend staging domain/API key.
- Store secrets in platform secret managers only.
- Run `pnpm db:migrate` and `pnpm db:seed` against staging.
- Run smoke tests and restore drill.

## Production

- Configure final domain and DNS.
- Create production Vercel environment.
- Provision production Railway PostgreSQL/PostGIS and Redis.
- Configure Cloudflare R2/Stream production buckets.
- Configure Sentry production project and alerts.
- Configure Resend production sender/domain.
- Verify Google Search Console domain property.
- Submit sitemap.
- Run final launch gates.

## Scheduled jobs and object lifecycle

The app runs two recurring maintenance jobs. On a single long-lived replica the
in-process timers (started from `instrumentation.ts`) are enough; on any
multi-replica or serverless deployment they must be replaced by **one**
external driver, or every replica sweeps/purges on its own.

| Job | In-process (single replica) | External driver (recommended) |
|---|---|---|
| Media retention sweep (PENDING 30d / REJECTED 14d / TAKEDOWN 7d) | on by default, every `MEDIA_RETENTION_SWEEP_INTERVAL_MINUTES` (60) | platform cron → `POST /api/internal/scheduled/media-retention-sweep/` with `Authorization: Bearer $CRON_SECRET`; then set `MEDIA_RETENTION_SWEEP=off` |
| Expired-requirement purge | not scheduled | platform cron → `pnpm privacy:requirements:purge` (see `scripts/privacy/purge-expired-requirements.mjs`) |

The cron endpoint fails closed: with no `CRON_SECRET` configured it returns
503 (never an open admin surface), and the comparison is constant-time.

### R2 lifecycle rules (operator task)

App-side retention deletes the object it owns (`deleteObject`) when a record is
expired, rejected or taken down, and stores the key on `PropertyMedia.objectKey`.
Objects that never made it into the app (a signed upload the user abandoned, or
an orphan from a crash) are still bounded by bucket-level lifecycle rules on the
R2 bucket itself, e.g. expire `listing-drafts/*` objects older than 14 days in a
`rejected/` or uncommitted prefix. Configure these in the Cloudflare dashboard
(or `r2 bucket lifecycle`) for the `R2_BUCKET` bucket. Keep the raw location
snapshots in R2 as well (see `docs/data/india-location-operations.md`), so the
Postgres/PostGIS tables — and therefore the backup — stay small.

## Abort conditions

Abort production enablement if:

- any legal gate is pending for an enabled feature,
- secrets are present in source control,
- staging migration fails,
- restore drill is missing or exceeds RTO/RPO,
- Search Console cannot verify domain,
- rollback procedure is untested.
