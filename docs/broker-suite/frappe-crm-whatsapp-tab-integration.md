# Frappe CRM WhatsApp Tab — implementation design for the business suite

**Date:** 07 Sep 2026
**Status:** Proposed design. **Not active.** Requires a v8 amendment per the governance change procedure before implementation (see §7).
**Scope:** How to deliver the official Frappe CRM WhatsApp feature — *"a dedicated WhatsApp tab on the Lead and Deal pages with a real-time chat window; Lead `mobile_no` initiates/receives messages; the Deal's primary contact number is used; all interaction history stays centralised in the lead/deal record"* — on the business-suite stack selected by [`decision.md`](./decision.md).
**Upstream verified:** this design was written against cloned source, not documentation claims, following [`upstream-repo-checkout-guide.md`](./upstream-repo-checkout-guide.md).

| Repo | Ref | HEAD | Role |
|---|---|---|---|
| `frappe/crm` | `v1.83.0` | `52c500d` | The pinned CRM. **Already contains the entire WhatsApp tab** (UI, API, hooks, realtime, tests). |
| `shridarpatil/frappe_whatsapp` | default branch (2026-08-04) | `08bc1f6` | MIT-licensed Meta Cloud API integration app that provides the `WhatsApp *` doctypes and transport the tab expects. |
| `evolution-foundation/evolution-api` | `2.3.7` | (repo pin, source re-verified for §5.3) | The pinned unofficial transport for Path B. |

Scratch clones live in `/tmp/refclones` and are not committed.

---

## 0. The one-sentence answer

The tab itself is **already shipped inside the Frappe CRM v1.83.0 we pin** — there is no tab to build. The work is choosing and attaching a **transport**: either install `frappe_whatsapp` (official Meta Cloud API — configuration only, but changes the v8 cost/legal model), or provide the same four-doctype contract from our own app backed by the pinned Evolution API (build effort, keeps v8 economics). Either way, v8 §7 rule 5 ("minimal activity markers, no message bodies") must be amended, because this feature centralises full message history in the lead/deal record.

---

## 1. How the feature actually works upstream (verified)

### 1.1 CRM side — all of it is in `v1.83.0` already

| Piece | File (frappe/crm `52c500d`) | What it does |
|---|---|---|
| Tab registration | `frontend/src/pages/Lead.vue`, `Deal.vue` (and `MobileLead.vue`, `MobileDeal.vue`) | Registers a `WhatsApp` tab; `condition: () => whatsappEnabled.value` |
| Feature flags | `frontend/src/composables/whatsapp.js` | Calls `crm.api.whatsapp.is_whatsapp_installed` (a `WhatsApp Settings` DocType exists) and `is_whatsapp_enabled` (default outgoing account set and its `WhatsApp Account.status == "Active"`) |
| Chat pane | `frontend/src/components/Activities/WhatsAppArea.vue`, `WhatsAppBox.vue`, `Modals/WhatsappTemplateSelectorModal.vue` | Message list, composer with attachments/emoji/replies/reactions, template picker for first-contact sends |
| Settings page | `frontend/src/components/Settings/WhatsAppSettings.vue` | A generic desk form: `<SettingsPage doctype="WhatsApp Settings" />` — any app that provides the doctype gets the settings UI free |
| API | `crm/api/whatsapp.py` | `get_whatsapp_messages(reference_doctype, reference_name)`, `create_whatsapp_message(...)`, `send_whatsapp_template(...)`, `react_on_whatsapp_message(...)` |
| DocType hooks | `crm/hooks.py` → `"WhatsApp Message": {"validate": [...], "on_update": [...]}` | `validate` resolves the counterparty number → Lead/Deal; `on_update` publishes realtime and notifies |
| Real-time | `crm/api/whatsapp.py::on_update` | `frappe.publish_realtime("whatsapp_message", {...})` → Socket.IO → the open tab refreshes live |
| Notifications | `notify_agent(...)` | Incoming message → `CRM Notification` for every user assigned to the lead/deal, deep-linking to it |
| Matching | `crm/integrations/api.py::get_contact_lead_or_deal_from_number` → `crm/utils` (`parse_phone_number`, `are_same_phone_number`, default region **IN**) | Lead `mobile_no` / Deal primary contact number ↔ inbound sender; Deal view also merges the originating Lead's thread |
| Access control | `crm/api/whatsapp.py::validate_access` | Roles `System Manager` / `Sales Manager` / `Sales User`, plus read permission on the referenced Lead/Deal |
| Contract tests | `crm/tests/test_whatsapp.py` | Upstream tests pinning the hook behaviour we would build against |

### 1.2 The integration contract the tab depends on

The CRM app is deliberately decoupled: it never imports `frappe_whatsapp`; it only requires that **these DocTypes exist on the site** and behave as expected:

1. `WhatsApp Settings` — singletons with `default_incoming_account`, `default_outgoing_account`
2. `WhatsApp Account` — per-number account records; fields CRM reads: `status` (`Active`), `is_default_outgoing`
3. `WhatsApp Message` — the thread store. Fields CRM reads/writes: `type` (`Outgoing`/`Incoming`), `status`, `to`, `from`, `message`, `content_type` (`text`/`document`/`image`/`video`/`audio`/`reaction`/…), `attach`, `message_id`, `is_reply`, `reply_to_message_id`, `template`, `template_parameters`, `message_type` (`Manual`/`Template`), `reference_doctype`, `reference_name`, `profile_name`
4. `WhatsApp Templates` — template picker source

**Send path:** the composer calls `crm.api.whatsapp.create_whatsapp_message`, which inserts a `WhatsApp Message` doc; the *providing app's* `before_insert` on that doctype performs the actual dispatch. **Receive path:** the providing app's webhook inserts a `WhatsApp Message` doc of type `Incoming`; CRM's own `validate` hook then links it to the Lead/Deal, and CRM's `on_update` does realtime + notifications. Neither path needs CRM modification.

`crm.api.whatsapp.add_roles` (run `after_migrate`) grants the Sales roles permissions on the WhatsApp doctypes, but only when `"frappe_whatsapp" in frappe.get_installed_apps()` — a differently named app must add the same permissions itself (§5.4).

### 1.3 What `frappe_whatsapp` itself is

MIT-licensed, by Shridhar Patil. Doctypes: `WhatsApp Settings`, `WhatsApp Account`, `WhatsApp Message`, `WhatsApp Templates`, `WhatsApp Profiles`, `WhatsApp Notification` (+log), `Bulk WhatsApp Message`, `WhatsApp Flow`. Transport is **Meta WhatsApp Cloud API only**: `WhatsApp Account` carries `token`, `url` (`https://graph.facebook.com`), `version`, `phone_id`, `business_id`, `webhook_verify_token`; sends go to `POST <url>/<version>/<phone_id>/messages`; the webhook at `frappe_whatsapp.utils.webhook.webhook` (guest, GET verify + POST ingest) creates `Incoming` docs and applies status callbacks. Multi-account = multiple `WhatsApp Account` docs.

Meta's rules apply on this path: business verification, per-message template pricing, and the 24-hour window (initiate only with an approved template; free text only after the customer replies).

---

## 2. The decision this design actually forces

The quoted feature is a **transport decision**, and both candidate transports collide with parts of the v8 decision ([`decision.md`](./decision.md)):

| v8 constraint | Path A: adopt `frappe_whatsapp` (Meta Cloud API) | Path B: Evolution-backed compatible app |
|---|---|---|
| §12 "no Meta billing / no mandatory vendor payment" | **Violated** — per-message template fees, Meta business verification | Preserved — Evolution stays the transport |
| §7 "linked-device path is unofficial and can break" | Avoided — official API | Retained risk (already accepted and gated in v8) |
| §7 rule 5 "minimal CRM activity markers, no message body/media copy" | **Violated** — full bodies/media stored in the Frappe site DB | **Violated** — same |
| §12 license gates | `frappe_whatsapp` is MIT; Meta platform terms need legal review | Our own app; AGPL CRM boundary unchanged |
| Effort | Configuration only | Build the §5 contract (~a focused week, plus gates) |
| Per-message cost model | Template messages billed by Meta (marketing category is the expensive one for real-estate outreach); service replies free | Flat self-hosting cost |
| Number risk | Registered business numbers only | Company-owned SIM numbers on linked devices (v8 model) |

**Either path amends v8.** The choice is: pay Meta per template message and get the official, supported transport (A), or build a small compatibility app and keep the pinned Evolution economics (B). This design recommends **B as the default** (it preserves the hosting-only baseline that is the product's stated selling point) while keeping A available as a per-business opt-in where a customer already accepts Meta billing. That is a product decision to record in the decision log before implementation, not something this document silently changes.

---

## 3. Path A — adopt upstream as-is (per-business opt-in)

1. `bench get-app https://github.com/shridarpatil/frappe_whatsapp --resolve-deps`, **pinned to commit `08bc1f6`** (v8 §12: pin immutable digests, never mutable tags).
2. `bench --site <business-site> install-app frappe_whatsapp`.
3. Meta side: create the WhatsApp Business Account, register/verify the business, add the company number, create a Cloud API token.
4. Site side: create a `WhatsApp Account` (`url=https://graph.facebook.com`, `version=<pinned>`, `phone_id`, `business_id`, token, `webhook_verify_token`, `status=Active`), set it as `default_outgoing_account` in `WhatsApp Settings`.
5. Point the Meta webhook at the business site's `/api/method/frappe_whatsapp.utils.webhook.webhook` **through the private gateway** (the gateway adds tenant authentication and keeps the site origin private; do not expose the site directly).
6. Create and approve first-contact templates in `WhatsApp Templates` (the acknowledgement template from the v8 immediate-dispatch flow).
7. The tab appears automatically (`is_whatsapp_enabled` → true); matching, realtime, notifications and history all work with zero CRM code.

Gates before a sold deployment on this path: Meta pricing reviewed against expected volume (template category mix), legal review of Meta platform terms (v8 §12), and the §8 gates that apply to both paths.

## 4. Why Path B is recommended as default

`frappe_whatsapp`'s send path and webhook are hard-wired to the Meta Cloud API payload shapes; reusing the app with Evolution underneath would mean overriding its internals, which is more invasive than providing the (small, stable, upstream-tested) doctype contract ourselves. The contract surface is four doctypes plus `before_insert` dispatch; everything the user actually sees — tab, composer, template picker, thread history, realtime, notifications, mobile pages — is CRM-owned code we do not touch, and CRM's own `test_whatsapp.py` pins the hook contract.

## 5. Path B — design: `business_suite_whatsapp` (Evolution-backed)

A small Frappe app — **a separately installable app (`business_suite_whatsapp`), not a module of `business_suite_core`** — that provides the CRM contract with Evolution as transport. Two reasons this packaging is forced (see the implementation plan §1.1): `bench get-app` installs one app per repository root, and the doctype names (`WhatsApp Settings`, `WhatsApp Message`, …) are the CRM-tab contract and collide with `frappe_whatsapp` — so a site choosing Path A (official Meta, `frappe_whatsapp` installed) must be able to install `business_suite_core` without ours, and vice versa. The two WhatsApp apps are **mutually exclusive per site, never both**.

### 5.1 DocTypes (same names and read-shapes as §1.2)

- `WhatsApp Settings` — `default_incoming_account`, `default_outgoing_account` (unchanged shape so CRM's flags and settings page work untouched).
- `WhatsApp Account` — one per company-owned Evolution session: `evolution_instance` (instance name on the shard), `phone_number` (E.164), `status` (`Active`/`Disconnected`/`Paused`), `is_default_incoming/outgoing`, `assigned_localities` (feeds the §6 area→account routing), `allow_auto_read_receipt`. No Meta fields.
- `WhatsApp Message` — CRM-visible fields exactly as §1.2. Internals: `evolution_message_id` (natural id for idempotency), `ack_status` (`pending`/`sent`/`delivered`/`read`/`failed`), `gateway_delivery_id`.
- `WhatsApp Templates` — **internal** templates (first-contact acknowledgement, visit reminder): no Meta approval step; stored as Jinja-ish bodies with `{{1}}` parameters, matching the picker UI. Used to keep the v8 rule that the first message after a consented lead is a governed template, not free text.

### 5.2 Outbound (tab → customer)

```text
Composer → crm.api.whatsapp.create_whatsapp_message   (CRM, unmodified)
         → WhatsApp Message.insert()                  (our doctype)
           before_insert:
             1. ownership check: session user is the lead's assigned
                owner, configured backup, or manager (v8 §6) — reject otherwise
             2. resolve WhatsApp Account via area→employee→account mapping
             3. POST gateway /outbox/send  → Evolution POST
                  /message/sendText/<instance>  (or sendMedia for attachments)
             4. store Evolution message id as message_id + evolution_message_id
                (or mark Failed and surface the badge the CRM UI already shows)
```

The gateway (not the site) holds the Evolution API key, applies consent/suppression checks, and scopes every call to the owning business's instance — one Evolution instance set per tenant, as v8 §10 already requires.

### 5.3 Inbound (customer → tab)

```text
Evolution webhook (messages.upsert)
  → private gateway:
      authenticate signature, resolve tenant from instance name,
      suppression & STOP check (central, per v8 §1),
      idempotency: skip if evolution_message_id already ingested
  → gateway POSTs site endpoint (ours, token-authed, non-guest)
  → insert WhatsApp Message { type: "Incoming", from: <customer>,
       message_id: <evolution id>, content_type, attach (media fetched
       through the gateway), profile_name }
  → CRM validate() links it to the Lead/Deal (number matching, region IN)
  → CRM on_update() publishes "whatsapp_message" realtime
     + notifies assigned users                     (CRM, unmodified)
```

Event mapping (Evolution 2.3.7, verified against source `evolution-foundation/evolution-api` @ tag `2.3.7`; event list in `src/api/integrations/event/event.controller.ts`, `StatusMessage` values in `src/api/types/wa.types.ts`, send routes in `src/api/controllers/sendMessage.controller.ts`):

> **Transport note (08 Sep 2026):** this mapping is Evolution-specific. The transport is a pluggable gated adapter by design; the full landscape survey ([`waha-transport-assessment.md`](./waha-transport-assessment.md)) recommends gowamd as primary candidate with WAHA conditional on its GOWS engine gaining a license — re-map to the selected transport's events (WAHA: `message`, `message.any`, `message.ack`, `session.status` in `src/structures/enums.dto.ts`; gowamd: whatsmeow event shapes) and feed any capping/reachout-timelock telemetry into the gateway's send-pause logic. The CRM-side contract (`WhatsApp *` doctypes) is transport-agnostic and does not change.

| Evolution event | Effect |
|---|---|
| `MESSAGES_UPSERT` (from customer, `key.fromMe` false) | insert `Incoming` doc (the case above) |
| `SEND_MESSAGE` (API send result) / `POST /message/sendText/:instance` response | sets `message_id` (Evolution's `key.id`) on the `Outgoing` doc |
| `MESSAGES_UPDATE` with `status`: `SERVER_ACK` / `DELIVERY_ACK` / `READ` / `ERROR` | updates `ack_status` sent/delivered/read/failed on the matched doc (`PENDING`/`PLAYED`/`DELETED` are recorded, not surfaced) |
| send failure (HTTP error) | marks `status: Failed` (red badge in the tab is stock CRM UI) |
| `CONNECTION_UPDATE` (disconnect) / `LOGOUT_INSTANCE` | sets `WhatsApp Account.status` → tab flag flips off; ops alert |
| `MESSAGES_UPSERT` with `key.fromMe` true (employee replied in the native WhatsApp app on the linked session) | insert as `Outgoing` (source: device), so history stays complete whichever interface the employee used |

That last row is the property that makes the tab compose with v8's "normal WhatsApp app" model instead of replacing it: Evolution is a linked device on the company number, so **both** interfaces write the same centralised thread.

### 5.4 Roles, permissions, tenancy

- `after_install`/`after_migrate` in our app grants `Sales Manager`/`Sales User` the same permissions on the four doctypes that `crm.api.whatsapp.add_roles` would have granted (it keys on the literal app name `frappe_whatsapp`, so it will not fire for us).
- One site per business (v8 §10) keeps thread data inside the tenant boundary; the gateway never routes a business's traffic to another business's instance (no cross-business fallback — v8 §6).
- Media: attachments are stored as private files; public sharing stays off. `attach` for received media uses a gateway-proxied URL, never a raw Evolution URL.

### 5.5 Number hygiene

Leads created from Architech's purpose-minimised lead event must carry `mobile_no` in **E.164** (`+91…`) so CRM's `parse_phone_number`/`are_same_phone_number` matching (default region IN) resolves threads deterministically. This is the same normalisation contract as Architech's `client/src/lib/interop/phone.ts`; the Architech lead-event adapter should enforce it at projection time.

## 6. Interaction with the immediate-dispatch flow (v8 §7)

The tab does not replace the automated first message:

- The high-priority worker still sends the first acknowledgement through the outbox→gateway→Evolution path; because that send is an Evolution send on the same company session, the resulting `messages.upsert`/ack events land the message in the lead's thread automatically — the employee opens the tab and sees the acknowledgement they never had to type.
- Consent, `STOP`, withdrawal and purpose-expiry remain gateway-enforced for **every** send, human or automated.
- Single active owner (v8 §6) is enforced at `before_insert` (§5.2 step 1): the pane is record-scoped, not a shared inbox — the v8 objection to Chatwoot does not apply to a per-lead/deal thread.

## 7. v8 decision impacts (must be recorded before implementation)

Per the governance change procedure, this feature requires an amendment stating affected decisions, evidence, rollout and reversal triggers:

1. **§7 rule 5 (minimal markers)** — replaced for WhatsApp by: full message bodies/media are stored in the business's own Frappe site (single-tenant DB, encrypted backups, retention-limited, restore-tested — §10). Reversal trigger: privacy/legal review or abuse.
2. **§12 (vendor payment)** — unchanged if Path B is default; Path A becomes a per-business, separately-approved opt-in where that business accepts Meta billing under its own account.
3. **§4 (no shared inbox)** — re-affirmed, not changed: the pane is scoped to one lead/deal record with ownership checks; there is still no cross-conversation inbox.
4. New evidence obligations: the §8 test matrix below.

## 8. Test and production gates

- **Contract parity:** upstream `crm/tests/test_whatsapp.py` passes against our doctypes (matching, realtime publish, notification, access control).
- **Event matrix (extends v8 §14):** API send → visible on employee phone; customer reply → appears in tab in real time; employee native-app reply → appears in thread as `Outgoing`; reaction/reply threading correct; ack statuses correct; **reconnect/replay of Evolution events creates no duplicate `WhatsApp Message` rows** (idempotency on `evolution_message_id`).
- **Negative tests:** unassigned employee cannot send from another's lead; suppressed/`STOP` number blocks both automated and human sends at the gateway; a business's site never ingests another business's instance events.
- **Lifecycle:** disconnect flips the tab off (no silent failures); number loss recovery drill from v8 §6.
- **Erasure:** privacy purge extends to `WhatsApp Message` rows, private files, and `WhatsApp Profiles` for that data subject, with restore-tombstone checks (v8 §9).
- **Latency target:** unchanged from v8 (worker→Evolution P95 ≤ 1 s acceptance); tab realtime is Socket.IO on the same site.

## 9. Phasing

1. Record the §7 amendment in the decision log; pick Path B (default) / Path A availability.
2. PoC in the sandbox: install pinned CRM v1.83.0 + a skeleton `business_suite_whatsapp` providing the four doctypes; tab renders; upstream contract tests pass.
3. Wire the gateway: outbound send, inbound ingest, ack mapping, idempotency; run the §8 event matrix against a company-owned test number behind feature flags.
4. Ownership/routing rules, media, templates, purge.
5. Two-business isolation + recovery drills, then the v8 §14 pilot gate.
