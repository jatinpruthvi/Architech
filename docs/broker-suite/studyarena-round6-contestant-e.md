# StudyArena

**Question:** as we decided  use both Server: https://github.com/chatwoot/chatwoot
Mobile app: https://github.com/chatwoot/chatwoot-mobile-app

then can can you please check how can we implement below requirement as well.

**Answered by** Contestant E · Round 6 · 02 Sept 2026

---

Because Chatwoot is fundamentally a customer communication platform and not a structured CRM like Twenty, using it for your mobile requirement means **Architech must remain the "brain"** while **Chatwoot becomes the mobile execution arm**. 

Chatwoot handles the **Lead Inbox (Pillar 1)** beautifully. However, it cannot handle custom data like the **Brokers Channel (Pillar 2)** or **Accounting (Pillar 3)**. 

Here is exactly how to implement the requirements from your `Broker Suite` document using the Architech + Chatwoot architecture.

### 1. Multi-tenancy (Requirement 5.1)
**Rule:** One broker = one isolated workspace.
*   **Implementation:** 1 Architech `BrokerOrganization` = 1 Chatwoot `Account`.
*   When a new broker signs up in Architech, call Chatwoot’s Admin API (`POST /platform/api/v1/accounts`) to provision their isolated tenant.
*   When a broker adds an employee in Architech, call Chatwoot API (`POST /api/v1/accounts/{account_id}/agents`) to create their login. 
*   This perfectly isolates leads. An agent at Broker A physically cannot see Broker B's conversations.

### 2. Lead Routing & Locality Assignment (Requirement 5.2)
**Rule:** Locality mapping and optional cold-caller handoff.
*   **The Brain (Architech):** Keep `AreaAssignment` and `ColdCallerSetting` in Architech. Chatwoot does not know what a "Locality" is.
*   **Mode A (Direct):** When a lead arrives, Architech determines the employee for that locality. Architech calls Chatwoot to create a conversation and sets `"assignee_id": <chatwoot_agent_id>`. The specific agent’s phone buzzes.
*   **Mode B (Cold Caller):** Architech creates the conversation and assigns it to the broker's designated cold-caller agent.
*   **Handoff to Hot:** When the cold caller qualifies the lead, they apply a label `stage:qualified` in the Chatwoot mobile app. This fires a webhook back to Architech. Architech reads the locality, finds the correct salesperson, and calls Chatwoot API to change the `assignee_id`.

### 3. Masking & Consent (Requirement 2.4)
**Rule:** Buyer phone is masked unless consented. DPDP erasure must be supported.
*   **Implementation:** When `mode` is `MASKED`, Architech creates the Chatwoot Contact with a placeholder name (e.g., "Buyer AT-1048") and **no phone number/email**.
*   All communication happens via Chatwoot's website widget or Architech proxy, keeping the phone hidden.
*   When consent is granted, Architech calls `PUT /api/v1/accounts/{id}/contacts/{contact_id}` and injects the real phone number. Now the broker can see it and tap "Call" in the mobile app.
*   **Erasure:** When the purge script runs in Architech, it triggers `DELETE /api/v1/accounts/{id}/contacts/{contact_id}` to wipe the data from Chatwoot.

### 4. Lead Lifecycle Pipeline (Requirement 5.2)
**Rule:** New → Contacted → Qualified (Hot) → Negotiation → Closed (Won/Lost).
*   **Implementation:** Seed every Chatwoot account with standard labels: `stage:new`, `stage:contacted`, `stage:qualified`, `stage:negotiation`, `stage:won`, `stage:lost`.
*   Brokers change labels directly from the mobile app.
*   Chatwoot webhooks (`conversation.updated`) notify Architech of label changes so you can update `Lead.status` in your main database for platform dashboards.

### 5. Brokers Channel & Accounting (Requirements 5.3 & 5.4)
**Rule:** Chatwoot has no concept of cross-broker matching or ledgers. 
*   **Implementation:** **These stay in Architech as mobile-responsive web views.**
*   Do not try to force property matching or commission splits into Chatwoot.
*   When a lead conversation in Chatwoot requires checking matches, use a **Chatwoot Custom Attribute**. Create an attribute named `Architech Profile`. Populate it with a secure URL (e.g., `https://app.architech.com/broker/leads/123/matches`).
*   The broker taps that URL inside the Chatwoot mobile app. It opens their phone's browser to the Architech interface where they can view matches, negotiate splits, and enter accounting data.

---

### What your exact build sequence looks like now

To pivot from the Twenty CRM plan to Chatwoot, update your **Phased Plan (Section 9)** to this:

1.  **P0:** Deploy Chatwoot Server. 
2.  **P1 (Tenant Provisioning):** Build Architech logic to call Chatwoot Platform APIs. When a `BrokerOrganization` goes active, create a Chatwoot Account + Inbox + Agents automatically.
3.  **P2 (Lead Sync & Masking):** Wire Architech lead capture to create Chatwoot Contacts/Conversations. Enforce masking (pass blank phone to Chatwoot if unconsented).
4.  **P3 (Routing & Pipeline):** Map Architech localities to Chatwoot `assignee_id`. Implement webhook listeners in Architech to catch label changes (`stage:qualified`) and trigger cold-caller reassignments.
5.  **P4 (Channel & Ledger):** Build the Brokers Channel (matchmaking) and simple Ledger natively in Next.js (Architech), accessible via web links embedded in Chatwoot agent panels.
