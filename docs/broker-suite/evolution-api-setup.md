# Evolution API setup

How to stand up the self-hosted Evolution API that the broker WhatsApp lead
acknowledgement depends on, and how Architech is wired to it.

Companion docs: [local-whatsapp-development.md](local-whatsapp-development.md)
for the synthetic pilot, and
[evolution-api-adoption-assessment.md](evolution-api-adoption-assessment.md) for
why this provider was chosen.

## What this gives you

One broker organization links one WhatsApp number and sends exactly one
acknowledgement per opted-in lead. There are no campaigns, sequences, bulk sends,
or repeated follow-ups, and the Architech dashboard intentionally has no logout,
pause, or delete control — disconnecting means removing the linked device in
WhatsApp.

## Architecture

```
Browser ──▶ Architech Next.js (/broker/agent/whatsapp, /api/broker/whatsapp/*)
                 │  server-only, apikey header
                 ▼
        Evolution API :8080 ──▶ WhatsApp (Baileys)
                 │  webhook: Authorization: Bearer <HS256 JWT>
                 ▼
        /api/internal/providers/evolution/webhook

Outbox worker (pnpm whatsapp:worker) ──▶ /api/internal/scheduled/whatsapp
```

The browser never talks to Evolution. `ARCHITECH_EVOLUTION_API_URL` is
server-only, and the QR image is proxied through an Architech route.

Evolution runs on its own PostgreSQL 16 and Redis 7 with their own volumes
(`architech_evolution_postgres`, `architech_evolution_redis`). It never touches
the application database or the application Redis.

## Prerequisites

- Docker Engine or Docker Desktop with the `docker compose` v2 plugin.
- Free port 8080 on the host.
- Node 22 and pnpm, for the app side.
- Outbound HTTPS egress from the container. Evolution talks to WhatsApp, and its
  root route additionally fetches `https://web.whatsapp.com/sw.js` to detect the
  current web client version on every request.
- A company-owned test number. Never a lead's or an employee's personal number.

## Quick start (one command)

From the repository root:

```bash
pnpm whatsapp:setup
```

That single command runs the whole sequence: preflight checks, secret
generation into `.env`, `docker compose up -d --wait`, a health probe, and a key
check. Add `--enable-flags` when you have recorded approval for the synthetic
pilot:

```bash
pnpm whatsapp:setup -- --enable-flags
```

Variants:

| Command | Effect |
|---|---|
| `pnpm whatsapp:setup -- --check` | Preflight only. No writes, no containers. |
| `pnpm whatsapp:setup -- --secrets` | Write secrets to `.env`, do not touch Docker. |
| `pnpm whatsapp:setup -- --down` | Stop the stack, keep volumes. |
| `pnpm whatsapp:setup -- --reset --yes` | Stop and delete the Evolution volumes. |
| `pnpm whatsapp:test` | Run the setup and worker unit tests. |

The script prints SHA-256 fingerprints of secrets, never the values.

## What the script actually does

If you prefer to run it by hand, these are the steps `evolution-setup.mjs`
performs.

### 1. Preflight

```bash
docker --version
docker compose version
docker info
```

### 2. Secrets

Four server-only secrets are required, plus two URLs. The script fills only the
empty ones in `.env`; a value you already set is never overwritten, and rotation
is always a deliberate edit.

| Variable | Kind | Consumed by |
|---|---|---|
| `ARCHITECH_EVOLUTION_API_URL` | URL | `src/lib/whatsapp/evolution.ts` — provider base URL |
| `ARCHITECH_EVOLUTION_API_KEY` | secret | Same file, sent as the `apikey` header; also becomes the container's `AUTHENTICATION_API_KEY` |
| `ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY` | secret | `src/lib/whatsapp/webhook.ts` — HS256 verification of inbound webhooks |
| `ARCHITECH_EVOLUTION_WEBHOOK_URL` | URL | `src/lib/whatsapp/store.ts` — registered on instance create |
| `ARCHITECH_WHATSAPP_WORKER_SECRET` | secret | `src/app/api/internal/scheduled/whatsapp/route.ts` |
| `ARCHITECH_IDEMPOTENCY_HMAC_KEY` | secret | `src/lib/interop/idempotency.ts` — opaque lead retry keys |
| `WHATSAPP_WORKER_TARGET_URL` | URL | `ops/scripts/whatsapp/outbox-worker.mjs` |

`.env` is the deliberate target, not `.env.local`. Docker Compose interpolates
`${ARCHITECH_EVOLUTION_API_KEY}` from `.env`, so the value the container
authenticates with and the value the app sends cannot drift apart.

`ARCHITECH_EVOLUTION_API_KEY` is one value doing two jobs: it is the app's
credential and the container's `AUTHENTICATION_API_KEY`. There is no separate
admin key.

The two feature flags stay `false` unless you opt in:

```
ARCHITECH_WHATSAPP_ENABLED=false
ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED=false
```

Both must be `true` for a send or connect to pass
`resolveWhatsAppPlanGate` in `src/lib/whatsapp/access.ts`. Leaving them off
everywhere except an approved pilot is the governance rule, so the script never
flips them on its own.

### 3. Start the stack

```bash
docker compose -f docker-compose.whatsapp.yml up -d --wait
docker compose -f docker-compose.whatsapp.yml ps
```

Three services start: `evolution-postgres`, `evolution-redis`, `evolution-api`.
The API port is bound to `127.0.0.1:8080` only, so it is not reachable from
outside the machine. `host.docker.internal` is mapped to the host gateway so the
container can call back into your dev server.

The image is pinned by digest:

```
evoapicloud/evolution-api:v2.3.7@sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339
```

Do not change the tag without re-reviewing `src/lib/whatsapp/evolution.ts`
against the new upstream API shape.

### 4. Verify

`GET /` is Evolution's documented health endpoint and needs no apikey:

```bash
curl -s http://127.0.0.1:8080/ | head -c 200
```

Expect `"message":"Welcome to the Evolution API, it is working!"` and a
`version` field. Then prove the key matches:

```bash
source <(grep -E '^ARCHITECH_EVOLUTION_API_KEY=' .env)
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "apikey: $ARCHITECH_EVOLUTION_API_KEY" \
  http://127.0.0.1:8080/instance/fetchInstances
```

`200` means the app and the container agree. `401` means the stack was started
before `.env` had the key — restart it.

### 5. App side

```bash
pnpm db:migrate
pnpm dev
pnpm whatsapp:worker -- --once
```

## Pairing a number

1. Sign in as a broker whose organization has an `ACTIVE` plan.
2. Open `/broker/agent/whatsapp`.
3. Choose connect. The QR is fetched by the server from
   `instance/connect/<instanceName>` and rendered as a data URL by
   `BrokerWhatsAppPanel`. Do not paste a QR into a log or a ticket.
4. In WhatsApp, use **Linked devices** to scan it.
5. Set the single acknowledgement template and check the preview before saving.
6. Create one synthetic opted-in lead, then run
   `pnpm whatsapp:worker -- --once`. Expect one provider acceptance and one
   `ACCEPTED` dispatch.
7. Repeat the same request with its idempotency key and confirm no second send
   occurs.

Instance names are opaque values generated in `src/lib/whatsapp/store.ts`. No
phone number appears in an instance name, a log line, or a URL.

## Endpoints the adapter uses

| Operation | Evolution route |
|---|---|
| Create instance | `POST instance/create` with `integration: WHATSAPP-BAILEYS`, `qrcode: true`, webhook `byEvents: false` |
| Fetch QR | `GET instance/connect/{instanceName}` |
| Connection state | `GET instance/connectionState/{instanceName}` |
| Send text | `POST message/sendText/{instanceName}` |

Inbound events are limited to `QRCODE_UPDATED`, `CONNECTION_UPDATE`,
`SEND_MESSAGE`, and `SEND_MESSAGE_UPDATE` (`EVOLUTION_EVENTS`). Anything else is
answered `204` and dropped.

**`byEvents` must stay `false`.** When it is set, upstream's
`WebhookController.emit()` rewrites the destination to
`${url}/${transformedWe}` — so a `QRCODE_UPDATED` event would POST to
`/api/internal/providers/evolution/webhook/qrcode-updated`, which does not exist
here and would 404. With it false, Evolution posts to the exact URL registered.
Verified against `evolution-api` 2.3.7 (`cd800f2`); see
[the contract audit](../findings/evolution-api-adapter-contract-audit-2026-09-12.md).

`instance/create` returns **201**, and `message/sendText` returns **201**, not
200. The adapter treats any `2xx` as success, so this is expected.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `curl /` connection refused | Container still booting | Wait for the healthcheck: `docker compose -f docker-compose.whatsapp.yml ps` |
| Healthcheck unhealthy, logs fine | Migrations still running | Give it the 60s `start_period`, then check again |
| Healthcheck slow or flaky | `GET /` fetches `web.whatsapp.com/sw.js` before responding | Expected upstream behaviour; the probe allows 30s with 10 retries. Check container egress. |
| `401` from `fetchInstances` | Stack started before `.env` had the key | `pnpm whatsapp:setup -- --down` then `pnpm whatsapp:setup` |
| Webhooks never arrive | Container cannot reach the host | Confirm `ARCHITECH_EVOLUTION_WEBHOOK_URL` uses `host.docker.internal`, not `localhost` |
| `WEBHOOK_NOT_CONFIGURED` | `ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY` empty | Rerun `pnpm whatsapp:setup -- --secrets` |
| `WEBHOOK_TOKEN_EXPIRED` | Host clock skew | Sync the clock; the window allows 15 minutes of past `iat` |
| `PROVIDER_DISABLED` in the dashboard | A flag is still `false` | Set both flags to `true` for an approved pilot only |
| `REAL_NUMBERS_DISABLED` | Second flag still `false` | Same as above |
| `NO_ACTIVE_PLAN` | Organization plan is not `ACTIVE` | Activate the plan through owner plan administration |
| Port 8080 already in use | Another service | Stop it, or change both the compose binding and `ARCHITECH_EVOLUTION_API_URL` |

Useful commands:

```bash
docker compose -f docker-compose.whatsapp.yml logs -f evolution-api
docker compose -f docker-compose.whatsapp.yml ps
docker compose -f docker-compose.whatsapp.yml config   # resolve interpolation
```

## Stop and reset

```bash
pnpm whatsapp:setup -- --down              # keep data
pnpm whatsapp:setup -- --reset --yes       # delete Evolution volumes
```

Or directly:

```bash
docker compose -f docker-compose.whatsapp.yml down
docker volume rm architech_evolution_postgres architech_evolution_redis
```

Neither touches the application `architech_postgres` volume.

## Staging and production

`docker-compose.production-like.yml` carries the same Evolution services behind
a `whatsapp` profile. It is a disabled-by-default scaffold, not a live
deployment.

```bash
docker compose -f docker-compose.production-like.yml --profile whatsapp config
```

Differences from local, all intentional:

- `expose: 8080` instead of a host `ports` mapping. Evolution stays on the
  private Compose network and is reached only through the application server.
- No hard-coded passwords. `EVOLUTION_POSTGRES_PASSWORD` and
  `ARCHITECH_EVOLUTION_API_KEY` come from the secret store.
- `CORS_ORIGIN` defaults to the real origin, not `localhost:3000`.

Before any non-local environment, per
[local-whatsapp-development.md](local-whatsapp-development.md):

1. Store every secret in the secret store. None in source control.
2. Serve the app over HTTPS so the webhook URL is a public HTTPS endpoint.
3. Point `ARCHITECH_EVOLUTION_WEBHOOK_URL` at that public HTTPS URL, since
   `host.docker.internal` is a local-only convenience.
4. Keep `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: "false"`, telemetry off, and
   the message/contact/chat persistence flags off.
5. Run `pnpm secrets:audit && pnpm env:audit && pnpm security:audit`.
6. Record the canary and operational approvals that gate real-number use.

## Security rules that do not change

- No secret value in source control, logs, error messages, or tickets.
- No raw phone number, QR content, rendered message body, or provider raw error
  in a log or a database row. Only bounded status codes, safe metadata, and
  payload hashes.
- No Evolution URL exposed to a browser.
- The provider URL and every key are server-only.

## Verification

```bash
pnpm whatsapp:test                 # setup + worker unit tests
pnpm secrets:audit
pnpm env:audit
pnpm security:audit
docker compose -f docker-compose.whatsapp.yml config
docker compose -f docker-compose.production-like.yml --profile whatsapp config
```
