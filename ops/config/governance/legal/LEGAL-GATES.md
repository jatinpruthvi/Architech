# Architech Legal and Compliance Gates

No feature covered by this document may be publicly enabled until its applicable legal gate has an owner, evidence, approval date, review date, and reversal process.

| Gate ID | Area | Required review | Owner | Evidence | Applies to |
|---|---|---|---|---|---|
| LEG-001 | RERA ingestion | Source terms, field mapping, provenance, freshness, correction, republication, and disclaimer review. | Legal + Data | Signed approval and source registry. | P1-RERA-001 and all RERA pages. |
| LEG-002 | Personal data | Notice, purpose, consent/withdrawal, access/correction/deletion, retention, processor inventory, security, and incident process. | Privacy + Security | Approved privacy record and data-flow map. | Auth, leads, saved searches, analytics, broker operations. |
| LEG-003 | Broker media rights | Ownership/license, upload authority, usage scope, attribution, takedown, expiry, and dispute handling. | Legal + Operations | Rights record linked to every public asset. | P1-MEDIA-001 and broker listings. |
| LEG-004 | Public-record republication | Permitted use, attribution, caching, update, correction, and liability review. | Legal + Data | Source policy and approved field list. | RERA, public market data, research assets. |
| LEG-005 | Email and messaging | Consent, transactional/marketing classification, unsubscribe, template, deliverability, retention, and abuse controls. | Legal + Product | Approved templates and preference record. | Resend, alerts, lead notifications. |
| LEG-006 | Sponsored links and PR | Disclosure, payment classification, `rel="sponsored"`/`nofollow`, editorial separation, and contract review. | Legal + Growth | Campaign approval and rendered-link audit. | Digital PR, paid placements, partnerships. |
| LEG-007 | Commercial leads | Consent, attribution, broker terms, fraud, dispute, billing, deletion, and data-sharing review. | Legal + Product + Finance | Approved commercial terms and event model. | Pay-per-lead and broker products. |
| LEG-008 | AI and generated content | Human review, source provenance, no-invention rules, disclosure where needed, and correction process. | Legal + Editorial + Security | Prompt/model/version and review record. | LLM search, guides, summaries, recommendations. |
| LEG-009 | Localization | Translation rights, editorial responsibility, claims review, locale metadata, and support process. | Legal + Localization | Language release checklist. | Hindi and future Indian-language pages. |

## Release procedure

The implementation owner opens a gate record, links the relevant requirement and work IDs, attaches evidence, requests legal review, records the approval or rejection, and sets a review date. A rejected or expired gate disables public exposure or changes the feature to a safe fallback. Legal approval does not replace security, accessibility, performance, SEO, or product acceptance tests.

## Prohibited assumptions

The project must not imply government or RERA endorsement, publish private personal data without an approved purpose and consent basis, use broker media without rights evidence, require ranking-passing links in partnership contracts, or present AI-generated property/regulatory claims as verified facts.
