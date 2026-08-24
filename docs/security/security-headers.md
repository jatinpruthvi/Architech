# Phase 1 Security Headers

Security headers are configured in `next.config.ts`.

Required headers for Phase 1:

- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`
- `X-DNS-Prefetch-Control`

Preview compatibility note: `frame-ancestors` allows `https://*.e2b.app` so Arena live preview can embed the app. Tighten to the production domain during deployment hardening.
