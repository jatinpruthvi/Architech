# Mobile calling and lead-progress workflow

**Date:** 02 Sep 2026
**Status:** Final v8 mobile workflow after end-to-end review; implementation not started
**Decision:** Employees use the installable Frappe CRM mobile web app for assigned leads and progress. A custom **Call from SIM** action opens the phone's normal dialer. Evolution continues to send/receive WhatsApp through company-owned accounts.

## 1. Simple employee flow

```text
New lead
  → assigned by area to Employee A
  → Evolution sends first WhatsApp from Company Number A
  → Employee A sees the chat in normal WhatsApp
  → Employee A opens My Leads in Frappe CRM
  → taps Call from SIM
  → phone dialer calls the customer
  → employee returns to CRM
  → selects call outcome + lead status + next follow-up
```

The customer uses only WhatsApp and normal phone calls. They do not install Frappe CRM or ERPNext.

## 2. Mobile experience

Frappe CRM is installable from `/crm` through Android Chrome or iOS Safari as a progressive web app. It still needs internet; do not promise offline operation.

The owned Frappe app adds a mobile-first **My Leads** view:

- assigned to me;
- grouped/filtered by locality;
- overdue follow-ups first;
- customer name, locality, requirement and current stage;
- assignment badge and first-action SLA;
- actions: **Call**, **Open WhatsApp**, **Add Note**, **Set Follow-up**, **Change Status**.

### Call from SIM

The custom action uses a standard `tel:` link to open the device dialer. The employee confirms the call and, on dual-SIM phones, chooses the company SIM if the operating system prompts.

After the employee returns to the CRM app, show a small **Log call result** sheet. A web app cannot reliably know whether a normal cellular call connected, its exact duration or its recording. The employee confirms the result; the application must not invent telephony evidence.

Only the assigned employee, configured backup and manager may reveal/call the number. Voice consent, do-not-call suppression, business calling hours and an attempt limit are checked before opening the dialer. The platform never auto-dials.

The inspected Frappe CRM `v1.83.0` source has an installable PWA and manual `CRM Call Log`, but its upstream automated **Make a Call** UI is limited to Twilio and Exotel. Those paid integrations are not selected. `Call from SIM` and the post-call result sheet are owned extensions.

## 3. Keep call outcome separate from lead progress

A call result is an activity; the lead/deal stage is business progress. Do not make every missed call look like pipeline movement.

### Call outcomes

- Connected — interested
- Connected — follow-up required
- Connected — meeting/site visit scheduled
- No answer
- Busy/call later
- Not interested
- Wrong/invalid number

### Lead/deal stages

```text
New → Contacted → Qualified → Proposal/Quotation
    → Negotiation → Won / Lost
```

The Real Estate profile can show **Site Visit Scheduled** between Qualified and Proposal/Negotiation.

### Simple rules

| Call outcome | Stage action | Required next action |
|---|---|---|
| No answer | Keep current stage | Retry date/time |
| Busy/call later | Keep current stage | Follow-up date/time |
| Connected — interested | Move at least to Contacted | Note + next follow-up |
| Qualified requirement | Convert Lead to Deal / Qualified | Expected value, need and next action |
| Meeting/site visit scheduled | Qualified / Site Visit | Appointment date/time |
| Not interested | Lost | Lost reason |
| Wrong/invalid number | Invalid/Lost and suppress contact | Reason; stop automation |

## 4. Area and WhatsApp-number routing

```text
Bopal lead  → Employee A → Company-owned Number A
Naroda lead → Employee B → Company-owned Number B
```

Each routable number/SIM/WhatsApp account must be owned or controlled by the company, even if an employee carries the phone. Do not use a personal employee number that disappears when the employee leaves.

The locality assignment selects both:

1. the single active Frappe CRM lead owner; and
2. the eligible Evolution WhatsApp account for the immediate message.

Use an explicit same-company fallback: primary area employee/account → configured backup → admin queue. If no eligible account is connected, hold and alert; never use an arbitrary personal or cross-business number. Native WhatsApp cannot enforce multi-agent assignment, so only the active owner replies.

If a lead is reassigned, CRM ownership changes immediately. The WhatsApp account does not silently change in the middle of a customer thread; perform an explicit handoff or continue from the original company account.

## 5. Manager view

Frappe CRM owns Leads and Deals. Managers can see:

- leads by stage, locality, source and employee;
- new and untouched leads;
- overdue follow-ups;
- call outcomes and notes;
- minimal WhatsApp sent/replied timestamps from Evolution events, without message body/media by default;
- Lead-to-Deal and Deal-to-Won conversion;
- lost reasons;
- expected value and closing date;
- per-employee activity and progress.

ERPNext owns Customer, Item, Quotation, Sales Order, Invoice, Payment, Accounting and Inventory. The same-site Frappe CRM integration creates/links the ERPNext customer and quotation when a deal reaches that stage.

ERPNext v16 still contains its older Lead/Opportunity module, but ERPNext's current official documentation says that built-in CRM is scheduled for removal in v17 and recommends Frappe CRM for new implementations. Therefore do not build this new mobile workflow on the deprecated ERPNext CRM workspace.

## 6. What remains free of mandatory vendor charges

- normal cellular call through the company's existing SIM/plan;
- installable Frappe CRM web app;
- manual Frappe CRM call logs, notes, tasks and stages;
- Evolution through the self-hosted linked WhatsApp account, subject to its existing legal/activation gates;
- no Twilio, Exotel, call-recording SaaS, per-minute API or Chatwoot.

Carrier voice/data, hosting, storage, backup and support remain real costs.

## 7. Implementation order

1. Install a pinned compatible Frappe CRM + ERPNext set on one test site.
2. Configure Lead and Deal statuses, locality, single-owner/backup assignment, channel consent and suppression.
3. Add the **My Leads** mobile saved view, assignment badge and first-action SLA.
4. Add **Call from SIM** with normalized `+91...` destination, role/consent/hours/attempt checks.
5. Add the post-return call-result sheet and manual `CRM Call Log` creation.
6. Require next action or lost/invalid reason based on outcome.
7. Add Evolution routing, **Open WhatsApp** and minimal sent/replied activity markers.
8. Add manager funnel, overdue follow-up and employee/locality reports.
9. Test Android, iPhone, dual-SIM, native WhatsApp event synchronization, reassignment, employee/lost-phone exit and two-business isolation.

## 8. Primary evidence

- [Frappe CRM mobile app installation](https://docs.frappe.io/crm/mobile-app-installation)
- [Frappe CRM Call Log](https://docs.frappe.io/crm/call-log)
- [Frappe CRM Lead](https://docs.frappe.io/crm/lead) and [Deal](https://docs.frappe.io/crm/deal)
- [Frappe CRM custom statuses](https://docs.frappe.io/crm/custom-statuses)
- [Frappe CRM and ERPNext integration](https://docs.frappe.io/crm/erpnext)
- [ERPNext CRM v17 removal notice](https://docs.frappe.io/erpnext/CRM#important-erpnext-crm-is-scheduled-for-removal)
- Inspected source: `frappe/crm` `v1.83.0` at `52c500d6bdac3cd51553f95cfae9c7a940d99f1a`
