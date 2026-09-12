# Local broker WhatsApp development

This stack is an opt-in development environment for the first one-time lead acknowledgement. It is not a production WhatsApp deployment and it does not enable campaigns, sequences, bulk messaging, or repeated follow-ups.

## Architecture and safety defaults

- Evolution API is pinned to `evoapicloud/evolution-api:v2.3.7@sha256:1bd8afc4a6cf48822e6cf02469aeae7bd35a12a6b616eacd1291926307f4d339`.
- The pinned source snapshot reviewed for the adapter is commit `cd800f2976e1e5b682fbf86a01ee4d85ae61f370`.
- Evolution uses its own PostgreSQL 16 volume (`architech_evolution_postgres`) and its own Redis 7 volume/namespace (`architech_evolution_redis`, `architech_evolution`). It never uses Architech's application database or Redis service.
- The local Evolution HTTP port is bound to `127.0.0.1:8080`. The provider URL is server-only; browser code talks to Architech routes, never directly to Evolution.
- The compose file has no Evolution Manager, disables telemetry, disables broad CORS, hides instance enumeration, keeps logs minimal, and does not persist inbound messages, contacts, or chats.
- `ARCHITECH_WHATSAPP_ENABLED` and `ARCHITECH_WHATSAPP_REAL_NUMBERS_ENABLED` remain `false` until the provider, image/source/license, privacy, secret, canary, and operational gates are approved. A local test must use a non-critical company-owned number.

The Evolution API image is multi-platform. The digest above is the v2.3.7 image index digest; Docker resolves the appropriate architecture while retaining a content-addressed pin.

## Start the local services

From the repository root:

```bash
docker compose -f docker-compose.whatsapp.yml up -d
docker compose -f docker-compose.whatsapp.yml ps
pnpm db:migrate
pnpm whatsapp:worker -- --once
```

Set the server-only values in the local environment before using a QR flow. At minimum, use a random `ARCHITECH_EVOLUTION_API_KEY`, `ARCHITECH_EVOLUTION_WEBHOOK_JWT_KEY`, `ARCHITECH_WHATSAPP_WORKER_SECRET`, and `ARCHITECH_IDEMPOTENCY_HMAC_KEY`; do not put them in source control. `ARCHITECH_EVOLUTION_API_URL` is `http://127.0.0.1:8080` for the local server, while `WHATSAPP_WORKER_TARGET_URL` points to the Architech server (normally `http://127.0.0.1:3000`).

The polling process is only a driver. It claims no rows and does not decrypt contacts or render messages itself. The server route performs tenant-scoped claims, safety checks, rendering, provider calls, and durable status transitions. A scheduled deployment must provide `ARCHITECH_WHATSAPP_WORKER_SECRET` through its secret store.

## Synthetic manual pilot

1. Use a non-critical company-owned test number. The broker company must control the number; never use a lead's or an employee's personal number for the pilot.
2. Start Architech and the local Evolution services. Keep both WhatsApp feature flags disabled until the operator has recorded approval for the local test.
3. In the Architech broker dashboard, use the WhatsApp connection panel. Scan the displayed QR with WhatsApp's **Linked devices** flow. The QR is served through Architech; do not expose the Evolution URL to a browser or paste a QR into logs.
4. Configure the single acknowledgement template. Use a short synthetic message and verify the template preview before saving.
5. Create one synthetic opted-in lead owned by that broker organization, with an active subscription and an active acknowledgement template. Run `pnpm whatsapp:worker -- --once` and verify exactly one provider acceptance and one `ACCEPTED` dispatch.
6. Repeat the same lead request with its idempotency key. Verify that no second provider send occurs and that the existing dispatch remains the only acknowledgement.
7. Remove the linked device from WhatsApp. This is the first-version disconnect mechanism. The Architech dashboard intentionally has no logout, pause, or delete controls.
8. Inspect application/provider logs and the database audit/dispatch records. Confirm that raw phone numbers, QR contents, provider API keys, rendered message bodies, and provider raw errors are absent. Only bounded status codes, safe metadata, and payload hashes may remain.
9. Keep real-number activation disabled after the pilot unless the separate operational gates are explicitly approved.

## Stop and reset local data

```bash
docker compose -f docker-compose.whatsapp.yml down
docker volume rm architech_evolution_postgres architech_evolution_redis
```

The final command is destructive to the local Evolution-only data volumes. It does not target Architech's `architech_postgres` volume.

## Operational checks

Run these before sharing a local setup or enabling a non-local environment:

```bash
node --test ops/scripts/whatsapp/outbox-worker.test.mjs
pnpm secrets:audit
pnpm env:audit
docker compose -f docker-compose.whatsapp.yml config
docker compose -f docker-compose.production-like.yml --profile whatsapp config
```

The production-like profile keeps Evolution behind the private Compose network with `expose`, not a host `ports` mapping. It uses separate Evolution database/cache services and remains a disabled-by-default operational scaffold until the secret store and approval gates are complete.
