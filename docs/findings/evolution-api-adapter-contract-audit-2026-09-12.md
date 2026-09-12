# Evolution API adapter contract audit — 2026-09-12

End-to-end check of `src/lib/whatsapp/evolution.ts` and the webhook route
against the actual upstream source, not the published docs.

**Upstream:** `evolution-foundation/evolution-api` tag `2.3.7`, commit
`cd800f2976e1e5b682fbf86a01ee4d85ae61f370` — the same commit the
`business_suite/evolution-api` submodule is pinned to. Cloned with
`git clone --depth 1 --branch 2.3.7 --single-branch`; HEAD confirmed by
`git rev-parse`. Reproduce per
[upstream-repo-checkout-guide.md](../broker-suite/upstream-repo-checkout-guide.md).

## Result

One real defect found and fixed. Everything else the adapter assumes is correct.

## Defect: `byEvents: true` sent every webhook to a 404

`src/lib/whatsapp/evolution.ts` registered the instance webhook with
`byEvents: true`. Upstream persists that as `Webhook.webhookByEvents`
(`event.manager.ts` → `webhook.controller.ts#set` → Prisma upsert) and then, in
`WebhookController.emit()`:

```ts
const we = event.replace(/[.-]/gm, '_').toUpperCase();
const transformedWe = we.replace(/_/gm, '-').toLowerCase();
...
if (instance?.webhookByEvents) {
  baseURL = `${instance?.url}/${transformedWe}`;
} else {
  baseURL = instance?.url;
}
```

So every event was POSTed to a per-event sub-path:

| Event | URL Evolution actually called |
|---|---|
| `qrcode.updated` | `…/providers/evolution/webhook/qrcode-updated` |
| `connection.update` | `…/providers/evolution/webhook/connection-update` |
| `send.message` | `…/providers/evolution/webhook/send-message` |
| `send.message.update` | `…/providers/evolution/webhook/send-message-update` |

Architech exposes exactly one route,
`src/app/api/internal/providers/evolution/webhook/route.ts`, and there is no
catch-all under `src/app/api/internal/providers/`. Every webhook would have
returned 404 — QR pairing state and send confirmations would never have reached
the app, while outbound sends still appeared to succeed.

**Fix:** `byEvents: false`, so Evolution posts to the exact registered URL.
Locked by the assertion in `src/lib/whatsapp/evolution.test.ts`.

## Verified correct

### Routes and methods

| Adapter call | Upstream route | Notes |
|---|---|---|
| `POST instance/create` | `instance.router.ts` `.post('/create')` | Returns **201** |
| `GET instance/connect/:instanceName` | `routerPath('connect')` | 200 |
| `GET instance/connectionState/:instanceName` | `routerPath('connectionState')` | 200 |
| `POST message/sendText/:instanceName` | `sendMessage.router.ts` | Returns **201** |
| `GET /` (healthcheck) | `index.router.ts` | No auth |
| `GET instance/fetchInstances` (key probe) | `routerPath('fetchInstances', false)` | `apikey` header |

`routerPath(path, param = true)` appends `/:instanceName` unless `param` is
false, which is exactly the shape the adapter builds.

The adapter treats any `2xx` as success (`response.ok`), so the 201s are fine.

### Authentication

`auth.guard.ts` reads `req.get('apikey')` and compares to
`AUTHENTICATION.API_KEY`. The adapter sends `apikey: <key>` — matches.

`instanceExistsGuard` explicitly skips `/instance/create` and
`/instance/fetchInstances`, so the global key alone is sufficient for both. That
is what makes the setup script's key probe valid: a 401 there means key
mismatch, not a missing instance.

### Request and response shapes

- `instance/create` response: `{ instance: { instanceName, instanceId, integration, status }, hash, webhook, qrcode }`. The adapter reads `instance.instanceId` and `instance.status` — both present.
- `instance/connect` QR: upstream `wa.QrCode` has `base64?: string`. The adapter reads `body.base64` — matches.
- `webhook` input DTO fields `url`, `headers`, `byEvents`, `base64`, `events` all map through `eventManager.setInstance()` into the persisted `Webhook` row.

### Event names

The adapter subscribes to `QRCODE_UPDATED`, `CONNECTION_UPDATE`,
`SEND_MESSAGE`, `SEND_MESSAGE_UPDATE`. All four exist in upstream's `Events`
enum (`wa.types.ts`) as `qrcode.updated`, `connection.update`, `send.message`,
`send.message.update`, and each normalises to the exact string the adapter sends
via `event.replace(/[.-]/gm,'_').toUpperCase()`. No typo, no stale name.

Note that `MESSAGES_UPSERT` (inbound chat messages) is deliberately not
subscribed to. That is correct for a send-only acknowledgement feature.

### Webhook JWT

Upstream `WebhookController.emit()`:

```ts
if (webhookHeaders && 'jwt_key' in webhookHeaders) {
  const jwtToken = this.generateJwtToken(webhookHeaders['jwt_key']);
  webhookHeaders['Authorization'] = `Bearer ${jwtToken}`;
  delete webhookHeaders['jwt_key'];
}
```

with

```ts
payload = { iat, exp: iat + 600, app: 'evolution', action: 'webhook' }
jwt.sign(payload, authToken, { algorithm: 'HS256' })
```

Architech's `verifyJwt` in `src/lib/whatsapp/webhook.ts` requires `alg === HS256`,
a valid `exp`, an `iat` within the last 900s / next 60s, and a
timing-safe HMAC-SHA256 comparison. That is compatible. The extra `app` and
`action` claims are ignored. Now covered by a regression test that signs a token
with upstream's exact payload shape.

Upstream sends webhook requests with `axios` and a 30s default timeout, and only
when `regex.test(instance.url)` for `/^(https?:\/\/)/` — the local
`http://host.docker.internal:3000/…` URL satisfies this.

### Compose environment variables

Every variable in `docker-compose.whatsapp.yml` was checked against upstream
`env.example` and `src/config/env.config.ts`:

- `SERVER_NAME/TYPE/PORT/URL`, `LANGUAGE`, `DEL_INSTANCE`, `QRCODE_LIMIT` — present.
- `AUTHENTICATION_API_KEY`, `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES` — present.
- `CORS_ORIGIN/METHODS/CREDENTIALS` — present.
- `LOG_LEVEL/COLOR/BAILEYS` — present.
- `DATABASE_PROVIDER`, `DATABASE_CONNECTION_URI`, `DATABASE_CONNECTION_CLIENT_NAME`, and all `DATABASE_SAVE_*` / `DATABASE_DELETE_MESSAGE` — present.
- `CACHE_REDIS_*` and `CACHE_LOCAL_ENABLED` — present.
- `RABBITMQ_ENABLED`, `SQS_ENABLED` — present. `KAFKA_ENABLED` is absent from `env.example` but is read at `env.config.ts:620`, so it is valid.
- `WEBHOOK_GLOBAL_ENABLED`, `WEBSOCKET_ENABLED` — present.
- `TELEMETRY_ENABLED`: upstream treats `undefined` as enabled, so the explicit `"false"` in compose is required and correct.
- `PROMETHEUS_METRICS`: maps to `METRICS.ENABLED` at `env.config.ts:874`. `"false"` means the `/metrics` route is never registered.

## Secondary finding: `GET /` makes an unbounded outbound call

The root handler in `index.router.ts` calls `fetchLatestWaWebVersion({})`, which
does `axios.get('https://web.whatsapp.com/sw.js')` with **no timeout
configured** before returning. Its fallback, `fetchLatestBaileysVersion()`, is
also a network call.

Consequences:

- The container needs outbound HTTPS to `web.whatsapp.com`, not just to WhatsApp.
- The documented health endpoint can be far slower than a local probe should be.

The Docker healthcheck therefore uses a 30s timeout, 10 retries, and a 60s
`start_period` rather than the 10s a purely local probe would need. The setup
script's own probe retries for up to 180s, so it tolerates the same slowness.

This is upstream behaviour, not something to configure away. If a deployment
cannot reach `web.whatsapp.com`, expect a slow-but-passing health route.

## Not a defect, but worth knowing

`instanceLoggedGuard` returns **403** when an instance name is already in use.
The adapter maps 403 to `PROVIDER_AUTH`, which would read as a credential
problem. Instance names are generated opaque values in
`src/lib/whatsapp/store.ts`, so a collision should not happen; if it ever did,
the error label would be misleading rather than the behaviour wrong.

## Checks run

```
pnpm install --frozen-lockfile     # node_modules was absent in this workspace
pnpm vitest run src/lib/whatsapp/  # 9 files, 36 tests passed
pnpm test                          # 2278 passed, 49 skipped
pnpm check                         # tsc --noEmit clean
pnpm lint                          # clean
pnpm whatsapp:test                 # 16 passed (ops scripts)
pnpm secrets:audit / env:audit / ops:audit   # all passed
```

The Docker stack itself was not started: no Docker CLI is available in this
workspace. Compose files were parsed with a YAML parser, and the healthcheck
command was extracted from the YAML and executed directly against a stub server
(exit 1 with nothing listening, exit 0 against a 200).
