# Production Provisioning Execution Checklist

**Date:** 24 Aug 2026  
**Status:** executable package prepared; external account access required.

## Prepared files

```text
vercel.json
railway.json
docker-compose.production-like.yml
.env.staging.example
.env.production.example
governance/environments/phase-1-environments.json
governance/secrets/phase-1-secret-inventory.json
```

## Local production-like rehearsal

When Docker is available:

```bash
docker compose -f docker-compose.production-like.yml up -d
cp .env.staging.example .env
# fill DATABASE_URL for local Postgres only; do not commit .env
pnpm db:migrate
pnpm db:seed
pnpm build
pnpm test:seo
pnpm test:perf
```

## Vercel setup

1. Import GitHub repository.
2. Use `vercel.json` defaults.
3. Configure preview, staging, production variables from `.env.*.example` names.
4. Keep production adapters disabled until staging is validated.

## Railway setup

1. Create Railway project.
2. Add PostgreSQL/PostGIS service.
3. Add Redis service.
4. Add app service if not using Vercel-only app hosting.
5. Use `/api/observability/health/` as health check.
6. Store all server secrets in Railway variables.

## Cloudflare setup

1. Create staging and production R2 buckets.
2. Create scoped R2 API token.
3. Configure public media base URL.
4. Do not expose secret access keys to browser.

## Sentry setup

1. Create staging and production projects.
2. Store DSNs in platform variables.
3. Keep client Sentry opt-in disabled until sampling policy is approved.

## Resend setup

1. Verify sending domain.
2. Store API key in server environment only.
3. Keep marketing email disabled until `LEG-005` approval.

## Search Console setup

1. Verify production domain property.
2. Submit `/sitemap.xml`.
3. Run URL inspection samples from `seo/monitoring/search-console.config.json`.

## Launch block rule

Production remains blocked until:

- staging migration passes,
- restore drill is recorded,
- legal gates are approved or features disabled,
- no secrets are in source control,
- rollback is tested,
- all release gates pass.
