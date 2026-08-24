# Phase 1 Guide Content System

**Date:** 24 Aug 2026

This slice converts the static `/guide` surface into a structured content system with routeable guide detail pages.

## Routes

```text
/guide/rera/gujarat/how-we-verify-rera/
/guide/locality/ahmedabad/paldi-buying-guide/
/guide/city/ahmedabad/home-buying-guide/
```

## Content contract

Guide content is defined in:

```text
client/src/lib/repositories/guides.ts
```

Each guide includes:

- route kind
- canonical path
- title
- summary
- author
- reviewer
- updated date
- editorial status
- sources
- sections

## SEO behavior

Guide detail pages render Article JSON-LD and canonical metadata.

Guides with `status !== "published"` are `noindex, follow` and are excluded from the sitemap by the `SeoPage` registry. This lets the team review content routes without prematurely publishing unapproved SEO pages.

## Production handoff

Before making guide pages indexable:

1. replace fixture guide records with database-backed `Guide`, `GuideSection`, `Author`, `Reviewer`, and `Source` records;
2. complete editorial/legal review;
3. set `status: "published"`;
4. verify Article JSON-LD and raw HTML SEO tests;
5. confirm Search Console sitemap discovery after publication.
