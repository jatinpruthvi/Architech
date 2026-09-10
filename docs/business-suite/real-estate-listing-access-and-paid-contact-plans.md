# Real-Estate Listing Access and Paid Contact Plans

## Executive conclusion

The proposed Architech model is commercially plausible and broadly consistent with Indian real-estate marketplaces, but the access rule should be refined. Major platforms generally allow listings to be discovered without payment, while monetising **contact access, qualified leads, preferential visibility, assisted service, or a capped number of owner contacts**. They do not establish a safe default of publishing every owner or broker phone number and exact address to every platform user.

Architech should therefore implement a three-layer model:

1. **Discovery is open or lightly gated.** Buyers, owners, and brokers can search listings and see the public listing summary, locality, approximate map area, photos, price, listing type, verification badges, and advertiser role.
2. **Sensitive contact access is controlled.** Phone numbers remain masked. A user may request contact through an in-app lead, a click-to-call relay, WhatsApp relay, or a limited reveal entitlement. Direct owner contact is available only after consent, a paid plan, or a controlled contact credit.
3. **Exact address is a higher-trust disclosure.** The public page should show locality and an approximate map pin. The full postal address or precise coordinates should be shown only when the owner or authorised broker has explicitly approved disclosure, or after an appointment/lead workflow with a recorded purpose.

This model supports a paid broker plan without turning Architech into a directory of exposed personal phone numbers and residential addresses.

## What the market currently does

| Platform | Public/discovery model | Paid value proposition | Contact pattern | Address implication |
|---|---|---|---|---|
| Housing.com | Property search and listing discovery are available on the platform. Housing Premium is positioned around direct contact with owner properties. | Housing Premium packages provide a fixed number of contacts, zero-brokerage positioning, alerts, and an assisted relationship-manager tier. | The official Premium page lists packages with 15, 25, or 50 contacts, depending on the selected plan. | Housing’s owner terms state that exact geographical location and postal address may be collected and hosted for a paid listing, but this is not evidence that every visitor receives the exact address. |
| 99acres | Listings are searchable and owners/dealers can publish or upgrade postings. | Dealer plans and premium listings sell higher search placement, more exposure, relationship-manager assistance, and related listing products. | The official dealer page focuses on leads, responses, upgraded placement, and assistance rather than universal public phone exposure. | The platform’s terms and disclaimers place responsibility for accuracy and verification on users. Architech should therefore separate public locality from controlled exact-address disclosure. |
| Magicbricks | The platform connects buyers and sellers and supports owner, agent, and listing services. | MB Prime is a paid subscription providing enhanced listing access, exclusive owner contacts, alerts, and coupons. | Contact access is explicitly a paid value proposition for owner contacts under MB Prime. | Magicbricks’ terms state that property locations and measurements may be approximate and require independent verification. Exact residential addresses should not be treated as universally public. |
| NoBroker | Tenant and buyer discovery is available, with a strong owner-contact proposition. | Relax and Assure plans provide up to 50 qualified owner contacts, relationship-manager assistance, alerts, and other assisted services; Freedom provides a smaller self-service contact allowance. | Contact access is quota-based and plan-based, not an unlimited directory. | The product emphasis is owner contact and assisted search rather than publishing every exact address publicly. |

The most relevant commercial precedent for Architech is therefore **contact quotas plus plan entitlements**, not unrestricted access to all personal data.

## Important distinction: listing visibility versus contact access

A listing can be visible without its sensitive fields being visible. This distinction should be explicit in Architech’s product language.

| Field | Public visitor | Signed-in buyer | Free verified broker/owner | Paid broker plan | Owner/advertiser |
|---|---|---|---|---|---|
| Listing title, photos, price, property type | Yes | Yes | Yes | Yes | Yes |
| City and locality | Yes | Yes | Yes | Yes | Yes |
| Approximate map area | Yes | Yes | Yes | Yes | Yes |
| Advertiser role: owner, broker, builder | Yes, with verification label | Yes | Yes | Yes | Yes |
| Masked phone suffix | Optional | Yes | Yes | Yes | Yes |
| In-app enquiry | Yes, subject to basic abuse controls | Yes | Yes | Yes | Yes |
| Relay call or WhatsApp relay | No or limited | By consent and quota | By entitlement | Included in quota | Yes for own listing, subject to policy |
| Raw phone number | No | Normally no | No by default | Only if explicitly entitled and consent permits | Own number only; never another person’s number without consent |
| Full postal address | No | No by default | No by default | Only after owner/advertiser approval or appointment workflow | Yes for own listing, subject to visibility setting |
| Exact coordinates | No | No | No | No by default; disclose only for a legitimate operational reason | Controlled by listing owner or authorised organisation |
| Owner-direct inventory filters | Basic discovery | Yes | Yes | Full plan feature | Not applicable |
| Broker inventory and collaboration data | No private fields | No | Limited | Yes, scoped to subscribed organisation and entitlement | Only where shared with the organisation |

The recommendation is to describe the paid plan as **“verified inventory and contact access”**, not as a promise to reveal every phone number and address.

## Proposed Architech product model

### 1. Identity and role model

Architech should separate the identity of the viewer from the identity of the advertiser. The minimum role set should be:

| Role | Purpose | Verification requirement |
|---|---|---|
| Buyer or tenant | Searches and contacts advertisers for a personal transaction | Phone verification and abuse controls |
| Owner | Publishes or manages a property they own or are authorised to market | Ownership or authority evidence for verification badge; exact evidence stays private |
| Broker or agent | Publishes and manages multiple properties for clients | Business identity, phone, organisation, and authorisation workflow |
| Builder or developer | Publishes project or inventory listings | Organisation and project verification |
| Brokerage manager | Manages organisation inventory, members, plan, and usage | Organisation-level verified account |

A user should not be able to self-declare “owner” or “broker” and immediately receive unrestricted access. The role controls what the user may publish and the plan controls what sensitive inventory the user may access.

### 2. Listing states

Each listing should have an explicit visibility state:

- **Public discovery:** visible to all visitors with masked contact and locality-level location.
- **Verified inventory:** visible with a verification badge after the advertiser passes the relevant checks.
- **Broker-shareable:** available to approved broker organisations under a share policy.
- **Owner-direct:** marked as owner-direct only after an owner verification or owner declaration with review controls.
- **Private or draft:** visible only to the owning organisation.
- **Paused, sold, rented, or expired:** removed from active search but retained for audit and retention policy.

The advertiser should choose whether a listing is available for broker collaboration. That choice should not automatically reveal the owner’s phone or exact residential address.

### 3. Contact entitlement model

Use an entitlement ledger rather than a simple `isPaid` flag. The ledger should record who received access, what was accessed, under which plan, and when the access expires.

Recommended entitlements:

| Entitlement | Suggested meaning |
|---|---|
| `listing.view` | View public listing content. Free. |
| `listing.owner_direct_filter` | Search and filter owner-direct inventory. Included in selected plans. |
| `contact.lead.create` | Send an enquiry without seeing the raw number. Free with rate limits. |
| `contact.relay.call` | Start a masked or platform-relayed call. Consumes a contact credit or plan allowance. |
| `contact.relay.whatsapp` | Start a relay conversation or templated WhatsApp handoff. Consumes a contact credit where applicable. |
| `contact.raw_phone` | Rare exception. Only after explicit advertiser consent, valid entitlement, and audit logging. |
| `location.exact_request` | Request exact address or appointment location. Does not automatically reveal it. |
| `location.exact_view` | View exact address after owner/authorised advertiser approval or an appointment workflow. |
| `inventory.broker_share` | View broker-shareable inventory under an organisation plan. |
| `inventory.export` | Export listing or contact data. Disabled by default and separately controlled. |

A paid plan should usually grant `contact.relay.call`, `contact.relay.whatsapp`, `listing.owner_direct_filter`, and `inventory.broker_share`. It should not automatically grant `contact.raw_phone` or unrestricted exports.

### 4. Recommended plan tiers

The following is a product structure, not a final price list. Prices should be tested by city, category, and customer segment.

| Plan | Target user | Included value | Sensitive-data policy |
|---|---|---|---|
| Free | Casual buyer, owner, or broker | Search, public listings, limited enquiries, own listing management | Masked contacts and locality only |
| Verified Broker Starter | Individual broker | Verified broker badge, saved searches, owner-direct filter, monthly relay-call credits, basic broker-shareable inventory | No raw phone or exact address by default |
| Broker Pro | Active broker or small team | Larger contact-credit allowance, priority owner requests, more saved inventory, follow-up workspace, call history, team seats | Relay contact included; raw details remain gated by consent and policy |
| Brokerage Team | Organisation | Shared seats, organisation inventory, manager analytics, assignment rules, audit exports, role-based permissions | Data scoped to the organisation and plan entitlements |
| Assisted / Concierge | High-value customer | Relationship manager, qualified matches, appointment coordination, verification support | Human-assisted disclosure; every disclosure remains purpose-bound and logged |

The paid plan should be sold around **qualified access and workflow productivity**, not around the promise that a customer can download a database of personal phone numbers.

## Exact-address policy

Exact address is not equivalent to a locality. A locality may be safely searchable; a full postal address, unit number, building entrance, or precise coordinates can create safety, stalking, fraud, and unwanted-contact risks.

Architech should use the following policy:

1. Public listings show locality, city, nearby landmark, and an approximate map radius or deliberately blurred pin.
2. The advertiser can choose `address_visibility = locality_only`, `request_after_lead`, `appointment_only`, or `public_exact`.
3. `public_exact` should be disallowed for occupied private residences unless the advertiser has a documented business reason and passes a safety review.
4. A buyer or broker can request the exact address. The request records the purpose, listing, requester, organisation, and timestamp.
5. The owner or authorised advertiser can approve, reject, or share only an appointment location rather than the full address.
6. A broker plan can make a user eligible to request exact location, but the plan alone should not override the owner’s disclosure choice.
7. Every exact-address view should be logged and revocable.

This preserves the commercial benefit of a paid plan while keeping disclosure under the control of the person or organisation responsible for the property.

## Phone-number policy

Phone numbers should remain encrypted at rest and masked in all list and search responses. The preferred contact sequence is:

1. The viewer clicks **Request contact** or **Call through Architech**.
2. Architech verifies the viewer’s session, role, entitlement, consent context, rate limit, and listing state.
3. Architech starts a relay call or opens a relay conversation. The advertiser’s raw number is not returned to the browser.
4. Architech records the access event, plan or credit used, and outcome.
5. The advertiser may revoke contact access or suppress calls.

A raw-number reveal should be treated as an exceptional capability. If the product later supports it, the response should be short-lived, watermarked where possible, protected against bulk scraping, and available only after explicit consent and a clear user-facing explanation.

## Broker-to-broker inventory

The user’s proposed broker use case should be implemented as a separate workflow from buyer-to-owner contact. A broker should be able to discover broker-shareable listings and request collaboration without automatically receiving the owner’s personal number.

Recommended broker workflow:

1. Broker A marks a listing as `broker_shareable` and chooses whether collaboration is open to all verified brokers, approved organisations, or invitation only.
2. Broker B searches that inventory through a paid plan or organisation entitlement.
3. Broker B sees the listing, commission or co-broker terms if permitted, listing freshness, advertiser role, verification status, and a **Request collaboration** action.
4. Broker A accepts or rejects the request.
5. Only after acceptance does Architech reveal the authorised business contact or start a relay channel.
6. The owner’s personal number and exact home address remain hidden unless the owner or authorised listing manager explicitly permits them.

This creates a strong paid feature for brokers without encouraging data scraping or bypassing the owner relationship.

## Changes recommended for the current Architech implementation

The existing implementation already has useful foundations: masked leads, encrypted phone ciphertext, server-side reveal gates, call logging, retention metadata, organisation scoping, and a plan check. The next product iteration should extend these foundations as follows.

### Data model

Add the following conceptual entities or fields:

| Entity or field | Purpose |
|---|---|
| `UserRole` | Owner, broker, builder, buyer, brokerage manager. |
| `BrokerOrganisationMember` | Maps a user to an organisation with a role and status. |
| `ListingVerification` | Stores verification type, status, evidence reference, reviewer, and expiry. |
| `ListingVisibilityPolicy` | Stores public, broker-shareable, owner-direct, address, and contact policies. |
| `Plan` and `PlanEntitlement` | Defines features, limits, cities, and validity. |
| `Subscription` | Binds a user or organisation to a plan with lifecycle status. |
| `UsageLedger` | Consumes contact credits, relay calls, exact-address requests, or exports atomically. |
| `ContactAccessEvent` | Records requester, listing, advertiser, access method, entitlement, purpose, outcome, and timestamp. |
| `AddressDisclosureRequest` | Tracks requested, approved, rejected, expired, and revoked address disclosures. |
| `BrokerCollaborationRequest` | Tracks broker-to-broker sharing and approval. |
| `ListingReport` | Supports incorrect owner, wrong number, duplicate, fraud, and unsafe-address reports. |

### API surface

Add or refine these endpoints:

- `GET /api/listings`: return public-safe fields only.
- `GET /api/listings/[id]`: return public listing detail and visibility capabilities, not raw contact data.
- `POST /api/listings/[id]/contact-request`: create a lead or relay request.
- `POST /api/listings/[id]/relay-call`: consume a relay entitlement and start a call.
- `POST /api/listings/[id]/address-request`: request exact address or appointment location.
- `POST /api/listings/[id]/address-request/[requestId]/decision`: advertiser approval or rejection.
- `GET /api/broker/inventory`: return broker-shareable inventory scoped to organisation and plan.
- `POST /api/broker/collaboration-requests`: request cooperation from another broker.
- `POST /api/broker/collaboration-requests/[id]/decision`: accept or reject collaboration.
- `GET /api/account/plan`: return current plan, entitlements, usage, renewal, and limitations.
- `GET /api/account/usage`: return contact credits and recent access events.
- `POST /api/listings/[id]/report`: report fraud, wrong contact, duplicate, or unsafe disclosure.

### Enforcement rules

The server must enforce all sensitive access. The client should receive capability flags such as `canRequestContact`, `canRelayCall`, `canRequestExactAddress`, and `canViewBrokerInventory`, but those flags are only UX hints. The server must re-check role, subscription, organisation scope, consent, listing state, rate limit, and usage balance at every action.

Usage consumption must be atomic. A failed relay call should not consume a credit unless the call provider confirms the attempt. Concurrent requests must not allow a user to spend the same contact credit twice.

Bulk access, scraping, repeated failed requests, rapid exact-address requests, and contact access across many unrelated localities should trigger rate limits or manual review.

## Suggested delivery phases

### Phase 1: Policy and contracts

Document the public-safe listing contract, owner-direct definition, broker-shareable definition, contact methods, exact-address policy, report categories, retention policy, and refund/credit policy. Add product copy that clearly distinguishes listing visibility from contact access.

### Phase 2: Role and verification

Implement role claims, organisation membership, owner/broker verification states, and listing verification badges. Keep evidence private and store only references and review outcomes in ordinary application tables.

### Phase 3: Plans and usage ledger

Implement plans, subscriptions, entitlement checks, atomic usage consumption, credit refunds for failed contact attempts, renewal/expiry handling, and plan-aware UI. Start with relay-call credits and owner-direct inventory filtering rather than raw-phone export.

### Phase 4: Broker inventory collaboration

Add broker-shareable inventory, collaboration requests, organisation-scoped search, approval workflow, and manager analytics. Keep owner personal details hidden until the sharing party authorises the next step.

### Phase 5: Address request workflow

Add locality-only public display, approximate map radius, address request, appointment-location sharing, approval, expiry, revocation, and audit history. Test this workflow specifically for occupied residences and high-risk listings.

### Phase 6: Abuse, privacy, and operational controls

Add phone and address access rate limits, duplicate and fraud reporting, wrong-number suppression, data subject deletion, retention purge, export restrictions, suspicious-usage alerts, and support tooling for disputed contacts.

### Phase 7: Monetisation experiments

Test plan packaging by city and user type. Compare monthly credits, prepaid contact packs, organisation seats, and assisted plans. Measure qualified conversations, appointments, conversion, refund requests, abuse reports, and owner opt-out rates. Do not optimise only for the number of phone reveals.

## Acceptance criteria

The feature should not be considered complete until all of the following are true:

1. Public listing APIs never return raw owner or broker phone numbers unless the listing is explicitly configured for public disclosure and the policy permits it.
2. Public listing APIs never return exact residential addresses by default.
3. A free user can discover listings and submit a masked enquiry without receiving a raw phone number.
4. A paid broker can search eligible broker-shareable or owner-direct inventory according to plan limits.
5. A paid plan does not bypass advertiser approval for exact address.
6. Relay calls, WhatsApp relays, address requests, raw reveals, and exports are separately auditable.
7. Contact credits are consumed atomically and refunded according to a documented failed-attempt policy.
8. Owners can revoke contact access and suppress future calls.
9. Brokers can collaborate without receiving private owner data by default.
10. Retention purge clears encrypted contact data and preserves a non-sensitive audit tombstone.
11. Abuse controls block scraping, rapid enumeration, and repeated requests.
12. All access-denial responses explain whether the blocker is role, plan, consent, owner approval, usage limit, or policy.
13. Subscription copy does not promise guaranteed leads, guaranteed property availability, or guaranteed deal outcomes.
14. The legal and privacy review approves the consent notice, purpose language, retention period, and disclosure controls before production launch.

## Recommendation for the immediate next step

Implement **Broker Pro v1** with free public discovery, masked contact, monthly relay-call credits, owner-direct filtering, broker-shareable inventory, and an owner-controlled address request flow. Do not implement unrestricted “view all mobile numbers and exact addresses.” That feature would create avoidable privacy, safety, scraping, and trust risk while offering less defensible differentiation than a verified, auditable contact workflow.

## References

[1]: https://housing.com/premium "Housing Premium — direct owner contact and contact-count plans"

[2]: https://housing.com/owner-terms-of-use "Housing.com Owner Terms of Use — listing data and exact location terms"

[3]: https://careers.housing.com/privacy-policy/ "Housing.com Privacy Policy — REP accounts, personal information, and direct contact"

[4]: https://www.99acres.com/do/buyourservices?userClass=A&ownerCommerce=false "99acres Dealer Plans — upgraded visibility, leads, and assistance"

[5]: https://property.magicbricks.com/terms/terms.html "Magicbricks Terms — subscriptions, owner services, and MB Prime owner contacts"

[6]: https://www.magicbricks.com/help/category-detail/contact-advertisers "Magicbricks Help — contacting property advertisers"

[7]: https://www.nobroker.in/tenant/plans "NoBroker Tenant Plans — owner-contact quotas and assisted plans"

[8]: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf "The Digital Personal Data Protection Act, 2023"
