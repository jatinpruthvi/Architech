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

The production readiness procedure must confirm legal approval, real source provenance, migration completion, backup verification, rate-limit behavior, and rendered-HTML SEO checks before enabling `PUBLIC_INDEXING_ENABLED`. A production deployment with that flag unset or set to `false` receives `X-Robots-Tag: noindex, nofollow`, an empty sitemap, and a disallow-all robots policy.

The current request-safety implementation is deliberately dependency-free and works as a baseline on free-tier infrastructure. It applies body-size, origin, and in-process burst controls to guarded mutations. Before a multi-instance launch, replace or supplement the in-process bucket with a shared edge or Redis-backed limiter so limits remain consistent across replicas.
