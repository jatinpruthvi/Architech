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

## Abort conditions

Abort production enablement if:

- any legal gate is pending for an enabled feature,
- secrets are present in source control,
- staging migration fails,
- restore drill is missing or exceeds RTO/RPO,
- Search Console cannot verify domain,
- rollback procedure is untested.
