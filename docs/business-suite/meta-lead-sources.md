# Meta lead sources — Facebook & Instagram lead capture

**Date:** 08 Sep 2026
**Status:** Design. Extends the ingestion contract ([`lead-ingestion-contract.md`](./lead-ingestion-contract.md)) with the Meta-specific channels. Not a decision; the DM-capture question (§4) is flagged DECIDE.
**Verified sources:** `frappe/crm v1.83.0` cloned — the entire `crm/lead_syncing/` module read in source (`lead_sync_source.py`, `facebook.py`, `background_sync.py`, doctype schemas); Meta lead-ads mechanics (Instant Forms run on both Facebook and Instagram placements; lead access via CSV / CRM integration / Lead Ads API), click-to-WhatsApp ad requirements (WhatsApp Business account linked to the Meta business portfolio), and the 24-hour window rules cross-checked against current 2026 guides.

---

## 0. Direct answer

Facebook and Instagram give a business **four distinct lead channels**, and they land in our stack through three different doors:

| # | Channel | What the buyer does | Where it lands | Build |
|---|---|---|---|---|
| 1 | **Meta Instant Forms (Lead Ads)** — FB *and* IG placements | Taps a pre-filled form inside the app | Frappe CRM's **native lead-sync module** (pull via Graph API) → `meta-ads` source | **Config + a stamping hook** |
| 2 | **Click-to-WhatsApp ads (CTWA)** — FB + IG placements | Taps the ad → a WhatsApp chat opens with the company number | The **transport** (WAHA/gowamd) inbound events → `whatsapp` source | **Already designed** (the WhatsApp-tab ingestion path) |
| 3 | **DMs (Messenger / Instagram Direct)** | Messages the business in-app | Native Meta apps; no capture by default | **Deferred / DECIDE** (§4) |
| 4 | **Website traffic from FB/IG ads** | Clicks through to a landing page | The business's own form → `website-form` source | **Already covered** (first-party form) |

The key architectural fact: **channels 1 and 2 are already solved by things this repo has designed** — the CRM ships the lead-sync module, and the WhatsApp transport surfaces CTWA conversations. The only new build is a small hook that stamps our contract's taxonomy/consent onto natively-synced leads.

## 1. Channel 1 — Meta Instant Forms via the CRM's native module (verified in source)

### 1.1 What ships in Frappe CRM v1.83.0

| Piece | File | What it does |
|---|---|---|
| `Lead Sync Source` | `lead_sync_source.py` | `type: Facebook`, page access token (Password field), linked page + lead form, `enabled`, `background_sync_frequency` (5 min → monthly; scheduled hooks in `background_sync.py`) |
| `Facebook Page` | `facebook_page.py` | Pages fetched and stored from the token on insert (`fetch_and_store_pages_from_facebook`) |
| `Facebook Lead Form` + questions | `facebook_lead_form.py` | Each form question is **mapped to a CRM Lead field** (first_name is mandatory-mapped) |
| `FacebookSyncSource` | `facebook.py` | `GET graph.facebook.com/{form_id}/leads?fields=id,created_time,field_data` with a `time_created GREATER_THAN last_synced_at` cursor; maps `field_data` via the question mapping; sets `source="Facebook"`, `facebook_lead_id`, `facebook_form_id`; duplicates → `Failed Lead Sync Log` as "Duplicate"; errors → failure log with traceback |

### 1.2 What Meta requires (the setup reality)

1. **Meta Business portfolio + ad account**, and a **Facebook Page**. For Instagram placements, an **Instagram professional account linked to the page** — the same Instant Form then runs on both platforms (ads run on FB and IG by default; exclusion is manual).
2. The lead form itself is built in **Ads Manager** (Leads objective → Instant Forms): pre-filled name/email/phone from the profile, plus custom qualifying questions — **including the WhatsApp opt-in checkbox we need for consent evidence (§1.4)**.
3. A **page/system-user access token** with lead-retrieval permission, pasted into the `Lead Sync Source` (the module stores it as a Frappe Password field). Test leads work in dev mode; production needs the Meta app's permission approved.

### 1.3 Integration design — native retrieval, our taxonomy on top

The native module is polling (5-minute floor), and it stamps `source="Facebook"` and no consent. Our contract needs `meta-ads` + `ad-opt-in` + evidence. **Recommended composition:**

```text
Meta Ads Manager ──(Instant Form submissions)──► Graph API
                                                      │ 5-min scheduled sync (native module, unmodified)
                                                      ▼
                                            CRM Lead (source="Facebook", facebook_lead_id)
                                                      │ business_suite_core after-sync hook:
                                                      │  • re-stamp source → "Meta Lead Ads" (meta-ads)
                                                      │  • consent → ad-opt-in, evidence = facebook_lead_id
                                                      │  • map the form's WhatsApp-checkbox question
                                                      │    → whatsappOptInEvidence (unlocks automated WhatsApp)
                                                      │  • phone → E.164 normalisation (interop/phone.ts rule)
                                                      ▼
                                            contract-conformant lead (routing, dedupe, permissions)
```

- The hook runs after each sync (the module's `sync_single_lead` inserts leads; the hook is a `CRM Lead` doc-event filtered on `facebook_lead_id is set`) — no fork of upstream code.
- **Phone normalisation matters here**: Meta returns the profile phone in `field_data`; it must pass through the same E.164 normaliser before it becomes `mobile_no`, or WhatsApp-tab matching breaks (the exact-string-match trap documented in `interop/phone.ts`).
- **Known upstream limitations, stated honestly** (from source): the fetch sets `limit: 100000` with a `TODO: pagination` — a form with >100k unsynced leads would silently truncate (irrelevant at pilot scale, worth watching); and sync is enqueue-on-long-queue (background), so "5 minutes" is a floor, not a guarantee.

### 1.4 Consent mapping (per the ingestion contract)

| Contract field | Value |
|---|---|
| `source` | `meta-ads` (subsource: campaign/form name) |
| `consentClass` | `ad-opt-in` |
| `evidence` | `meta:leadform:{facebook_lead_id}` |
| `whatsappOptInEvidence` | `meta:leadform:{facebook_lead_id}:whatsapp-checkbox` — **only** if the form carried the WhatsApp opt-in question and it was ticked; without it the lead ingests with automated WhatsApp locked (the contract's downgrade rule) |
| `occurredAt` | the lead's `created_time` |

### 1.5 Webhook alternative (later, optional)

Meta also pushes `leadgen` webhooks in real time to a Meta-app endpoint. That would mean: our own Meta app, app review, a public webhook receiver in `business_suite_core`, and duplicate machinery the native module already has. **Not worth it until 5-minute latency is a measured problem** — record it as the upgrade path.

## 2. Channel 2 — Click-to-WhatsApp ads (the India-natural channel)

For Indian real estate, CTWA is often the highest-quality Meta channel: the buyer taps the ad and lands **directly in a WhatsApp chat with the company number**, pre-filled opener, no form at all.

### 2.1 How it lands in our stack with zero new ingestion code

```text
FB/IG ad ("Send WhatsApp message" CTA)
  → buyer's WhatsApp opens a chat with the COMPANY number
  → the number is a linked session on the transport (WAHA/gowamd)
  → inbound message event → gateway (auth, suppression, idempotency)
  → business_suite_whatsapp / ingestion → CRM Lead
```

- The buyer **initiated** the conversation — the strongest conversational consent there is; replies from the company number are the natural response, not cold outreach.
- **Contract mapping**: `source: whatsapp` (medium messaging, digital-owned), `consentClass: first-party-form` — the "surface" is the business's own WhatsApp and the buyer acted first; evidence = the inbound message id. `subsource` carries the campaign (the ad's pre-filled opener text and UTMs distinguish campaigns); `occurredAt` = the inbound timestamp.
- The conversation continues in the already-designed surfaces: the employee sees it in the CRM's WhatsApp tab (or the normal WhatsApp app — both write the same thread via the transport's linked-device property).
- **One important nuance**: response speed is the conversion driver (industry guidance is minutes). The v8 §7 immediate-dispatch design applies here with a twist — there is no consented *lead commit* to trigger on, so the "immediate first message" is simply the employee (or a later, separately-approved auto-greeting) replying in-session. Do not bolt automated first-touch onto CTWA without the same gating as every other automation.

### 2.2 Prerequisites

WhatsApp Business account for the company number, linked to the Meta business portfolio (Business Settings → Accounts → WhatsApp Accounts), the number verified, and the ad built with a messaging destination. Both the free WhatsApp Business app tier and the API tier can receive CTWA conversations; in our architecture the "receiver" is the transport's linked session on the company-owned number, so no Meta Cloud API signup is required for capture. (Running CTWA at scale with automated template follow-ups outside the 24-hour window would be an official-path feature — the same paid-profile boundary as broadcast.)

## 3. Channel 3 — Messenger / Instagram DMs: DECIDE

DMs are an inbox-shaped surface, and the v8 decision removed the shared-inbox product. Options:

| Option | Cost | Verdict |
|---|---|---|
| **A. Respond natively, log manually** — employees answer DMs in the Meta apps; a lead is created when the conversation yields a phone number (`manual` source, evidence = employee) | Zero build | **Recommended default** — matches the v8 "normal app + CRM progress" pattern |
| **B. DM→lead adapter** — Instagram Messaging API / Messenger Platform webhook in `business_suite_core` creates a lead on first inbound DM (message text as remarks; no phone until shared) | Medium build + Meta app review; conversations still live in Meta apps; PII flows through a new channel | Defer; only if DM volume proves it |
| **C. Reintroduce a shared inbox (Chatwoot-class)** | Rejected by v8 | No |

The Messenger-destination lead ads (automated questions in chat) fall under the same decision: they can be run with manual follow-up (Meta shows the conversations in the page inbox) or deferred.

## 4. Channel 4 — FB/IG traffic to the website

Ads with a website destination land on the business's (or Architech's) pages; the enquiry form is the capture point → `website-form` / `architech-website`, `first-party-form` consent. Attribution (Pixel/Conversions API, UTMs) is the analytics layer, not ingestion — tracked under the metrics spine, and the CTWA guide's UTM guidance applies to both.

## 5. Source/consent summary (one table for all four channels)

| Channel | `source` | `consentClass` | Evidence | Automated WhatsApp |
|---|---|---|---|---|
| Instant Form (FB/IG) | `meta-ads` | `ad-opt-in` | `meta:leadform:{id}` | Only with the form's WhatsApp checkbox |
| Click-to-WhatsApp | `whatsapp` | `first-party-form` | inbound message id | In-session replies are the norm; outbound automation stays gated |
| DM (manual log) | `manual` | `walk-in-verbal`-equivalent (record employee) | employee id | ❌ |
| Website form | `website-form` / `architech-website` | `first-party-form` | form submission id | ✅ |

## 6. Setup checklist and gates

1. Meta business portfolio, page, IG professional account (linked), ad account.
2. Instant Form built with: qualifying questions mapped to CRM fields, privacy policy link, **WhatsApp opt-in checkbox question**.
3. Access token (lead-retrieval scope) → `Lead Sync Source`; pages/forms fetched; question mapping completed (first_name mandatory).
4. `business_suite_core` stamping hook deployed; verify one test lead round-trips with correct source/consent/phone E.164.
5. CTWA: company number linked to the portfolio; ad with messaging destination; verify the inbound conversation appears in the transport events and creates the lead.
6. Gates: consent-class fixtures per channel; the §1.3 phone-normalisation test; erasure drill covers Meta-sourced leads; ad-spend attribution stays in the metrics spine (per-lead cost is the business's own ad spend — a real cost, disclosed, not a software fee).

## 7. Build-order impact

Small: (a) the stamping hook (S), (b) CTWA verification against the already-designed transport ingestion (config + tests), (c) everything else is Meta-side setup. This slots into the ingestion-spine step alongside the portal adapters — Meta Ads moves from "config only" to "config + small hook," which the coverage mapping already anticipated.
