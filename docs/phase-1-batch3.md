# Phase 1 Batch 3 — Search UX, Media Attach, Lead Privacy, Ops Status

**Date:** 25 Aug 2026  
**Scope:** Fills remaining implementable gaps without external accounts: server-backed search suggestions in the results surface, media attach to a broker draft, lead privacy/removal actions in the inbox, and a consolidated service-status endpoint. Each has a contract test.

## Steps shipped

| # | Workstream | Delivered |
|---|---|---|
| 1 | `P1-SEARCH-002` | `useSearchSuggestions` hook (debounced, abortable) wired into a server-backed quick-search box on the results page; suggestion dropdown re-runs the query. |
| 2 | `P1-BROKER-001`, `P1-MEDIA-001` | Media attach/detach to a broker draft: `attachMediaToDraft`/`detachMediaFromDraft`/`listDraftMediaIds` (workflow), server adapter passthroughs, and `GET/POST /api/broker/listings/:id/media`. |
| 3 | `P1-LEAD-001`, `P1-DATA-002` | Lead inbox "Revoke consent" and "Remove" actions wired to `DELETE /api/broker/leads/:id?mode=consent|delete`. |
| 4 | `P1-OBS-001` | Consolidated `GET /api/observability/status` (health + SLO + endpoints). |

## Notes

- **Search suggestions** are now server-backed and debounced (180 ms), abort in-flight requests, and never resolve after unmount — consistent with the canonical alias module rather than a client reimplementation.
- **Media attach** keeps a per-draft memory store (durable persistence arrives with the media pipeline). The API contract locks the shape.
- **Lead privacy** surfaces the soft-delete + consent-revoke workflow already added at the domain layer, closing the UI loop (retention-privacy).
- **Consolidated status** lets dashboards rely on one endpoint; the API contract suite asserts its shape.

## Validation

```bash
pnpm check
pnpm lint
pnpm test          # 46 files / 221 tests
pnpm build
pnpm test:seo
pnpm test:perf
pnpm db:validate
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm provisioning:audit
```
