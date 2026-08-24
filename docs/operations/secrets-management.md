# Phase 1 Secrets Management

**Policy:** secret names may be committed; secret values must never be committed.

Machine-readable inventory:

```text
governance/secrets/phase-1-secret-inventory.json
```

## Storage rules

- GitHub: repository/environment secrets only.
- Vercel: project/environment variables only.
- Railway: service variables only.
- Cloudflare: API tokens in platform secret stores only.
- Local: `.env` is gitignored and must not be shared in chat.

## Rotation

Server secrets default to 90-day rotation unless provider policy requires shorter rotation. Public DSNs and public site URL are tracked separately because they are intentionally browser-visible.

## Required production secret names

- `NEXT_PUBLIC_SITE_URL`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `RESEND_API_KEY`
- `GSC_CREDENTIALS`

## Chat/token rule

Any token pasted in chat must be revoked/regenerated immediately after use.
