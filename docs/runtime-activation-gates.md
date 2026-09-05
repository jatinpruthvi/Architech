# Runtime activation gates

Architech keeps the public indexability and live-provider boundary explicit. A local or preview environment may use fixture adapters and the demo session, but a production deployment must opt into live behavior deliberately.

| Variable | Required production value | Purpose |
|---|---|---|
| `PUBLIC_INDEXING_ENABLED` | `true` only after approval | Allows public HTML, sitemap, and robots to advertise indexable pages. |
| `ARCHITECH_AUTH_SOURCE` | `better-auth` | Selects live session resolution. Demo auth is rejected by private route guards when `NODE_ENV=production`. |
| `ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION` | **never set in real production** | Preview/E2E escape hatch only: lets `better-auth-contract-demo` sessions call permission-gated APIs on a production build (e.g. the public concept preview, `tests/e2e/marketplace-flows.mjs`). Default-off keeps demo writes refused with 503. |
| `ARCHITECH_DATA_SOURCE` | `prisma` | Enables durable listing and organization persistence. |
| `ARCHITECH_RERA_SOURCE` | `gujarat` | Enables the approved Gujarat RERA adapter. |
| `ARCHITECH_LEAD_STORAGE` | `prisma` | Enables durable lead storage and retention workflow. |
| `ARCHITECH_MEDIA_STORAGE` | approved R2 mode | Enables durable media storage and lifecycle controls. |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL` | real non-empty secrets/URL | Required for live authentication and database-backed sessions. |
| `MEDIA_RETENTION_SWEEP`, `MEDIA_RETENTION_SWEEP_INTERVAL_MINUTES` | unset/default; set `off` only deliberately | Enables the in-process retention sweep (default interval 60 min) applying PENDING 30d / REJECTED 14d / TAKEDOWN 7d policy with audit events. |
| `SAVED_SEARCH_ALERTS`, `RESEND_API_KEY`, `SAVED_SEARCH_ALERT_FROM` | set together, after LEG-005 | Saved-search alert emails: registered on the listing event spine only when all three are present; without them the gate logs the silence once and `/api/observability/status` reports the missing names. |
| `LEAD_NOTIFICATIONS`, `RESEND_API_KEY`, `LEAD_NOTIFICATION_FROM` | set together, after LEG-005 | Broker-side new-enquiry emails to active org members. Idempotency-keyed; buyer PII never crosses. |
| `BUYER_REPLY_NOTIFICATIONS`, `RESEND_API_KEY`, `BUYER_REPLY_NOTIFICATION_FROM` | set together, after LEG-005 | Buyer-side "the partner acknowledged/replied" transactional email, sent only to the address the buyer consented with at enquiry time; a lead without an email is never mailed. |

The production readiness procedure must confirm legal approval, real source provenance, migration completion, backup verification, rate-limit behavior, and rendered-HTML SEO checks before enabling `PUBLIC_INDEXING_ENABLED`. A production deployment with that flag unset or set to `false` receives `X-Robots-Tag: noindex, nofollow`, an empty sitemap, and a disallow-all robots policy.

The current request-safety implementation is deliberately dependency-free and works as a baseline on free-tier infrastructure. It applies body-size, origin, and in-process burst controls to guarded mutations. Before a multi-instance launch, replace or supplement the in-process bucket with a shared edge or Redis-backed limiter so limits remain consistent across replicas.

**Single-replica constraint (M-5), documented and now queryable:** the listing event spine (SEO discovery, saved-search alerts, lead notifications) and the media-retention sweep run in-process on `instrumentation.ts`. That is reliable on exactly one long-lived Node replica and silently split-brain across two. The multi-instance path is a durable queue + shared cron, not two replicas each thinking they sweep alone. Until that path is provisioned, deploy with a single replica; `GET /api/observability/status` reports each gate's `mode: "in-process-single-replica"` and the missing credential names for every disabled provider gate, so the assumption is a machine-checkable fact rather than tribal knowledge.
