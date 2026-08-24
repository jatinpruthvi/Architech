# Google Search Console Operations — Phase 1

**Date:** 24 Aug 2026  
**Workstream:** `P1-SEO-004`

This document operationalizes the Google-first SEO foundation. It does not require Search Console credentials in the repo.

## Setup checklist

1. Create a Google Search Console **Domain property** for the production domain.
2. Verify domain ownership with DNS TXT.
3. Confirm `NEXT_PUBLIC_SITE_URL` points to the production canonical origin.
4. Submit the canonical sitemap:

```text
/sitemap.xml
```

5. Run URL Inspection on:

```text
/
/buy/ahmedabad/
/buy/ahmedabad/paldi/
/listing/garden-courtyard/
```

6. Save the first baseline snapshot after discovery.

## Local config/audit

Config:

```text
seo/monitoring/search-console.config.json
```

Audit command:

```bash
pnpm seo:gsc:audit
```

## Alert thresholds

| Signal | Phase 1 threshold |
|---|---:|
| Indexed ratio | warning below 85% |
| Sitemap errors | critical above 0 |
| Coverage errors | critical above 0 |
| Organic click drop | warning above 35% vs previous snapshot |

## Manual weekly workflow

Until Search Console API credentials are provisioned:

1. Open Search Console.
2. Check sitemap status.
3. Export Pages/Indexing summary.
4. Export Performance summary.
5. Compare with previous baseline using thresholds from `client/src/lib/seo/monitoring.ts`.
6. File remediation issues for canonical, robots, lifecycle, content-quality, or crawl-depth problems.

## API handoff

When credentials are available, add a server-only adapter that:

- reads Search Console API credentials from secret storage
- fetches sitemap/indexing/performance data
- writes snapshots to database/object storage
- emits alerts through the observability logger
- never stores Google credentials in source control
