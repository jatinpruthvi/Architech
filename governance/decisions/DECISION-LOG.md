# Architech Decision Log

Decision IDs are stable. A decision may be superseded, but its ID remains in the history. Every decision links to requirement IDs, implementation work, evidence, and a reversal trigger.

| Decision ID | Decision | Rationale | Requirement/work links | Evidence required | Reversal trigger |
|---|---|---|---|---|---|
| DEC-001 | `final-three-phase-architecture.md` is normative. | Prevents conflicting specifications. | GOV-001, P1-GOV-001 | Supersession manifest and README reading order. | Product/tech owner approves a replacement normative document. |
| DEC-002 | Approved advanced capabilities are retained, but readiness and activation are separate. | Preserves the requested product ambition without forcing unsafe public exposure. | GOV-005, GOV-006, P1-GOV-001 | Status and feature-flag audit. | A capability is removed only through an explicit superseding decision. |
| DEC-003 | Railway is primary persistent-services platform; Fly.io is portable recovery/migration option. | Avoids two equal operational runbooks. | GOV-004, P1-PLAT-002 | Deployment, backup, and recovery evidence. | Region, cost, availability, support, or recovery requirements materially fail. |
| DEC-004 | Public contact is masked by default; direct contact requires explicit consent and audit. | Protects users while preserving a conversion path. | GOV-003, DOM-004, P1-LEAD-001 | Consent, delivery, deletion, and audit tests. | Legal or abuse evidence requires disabling direct mode. |
| DEC-005 | Google is primary search priority; Bing/IndexNow are adapters. | Focuses limited operating capacity on the strategic channel. | SEO-007, P1-SEO-004 | Search Console health and SEO release report. | Business strategy changes or Google integration becomes unavailable. |
| DEC-006 | Off-page work is earned authority and digital PR, not backlink quotas. | Reduces link-spam and reputation risk. | SEO-008, P1-OFF-001 | Asset registry, outreach governance, disclosure review. | Legal/policy review identifies a prohibited tactic. |
| DEC-007 | Hindi/Devanagari foundations are Phase 1; broad Hindi publication is quality-gated. | Localization is costly to retrofit; thin translation is harmful. | UX-004, P1-I18N-001, P2-I18N-001 | Font/layout/translation/SEO evidence. | Editorial quality or support capacity fails. |
| DEC-008 | Next.js stable patched 16.x is selected with implementation-time verification. | Avoids planned migration while controlling framework risk. | P1-PLAT-001 | Version lock, security review, rollback, route tests. | Stable release lacks required behavior or security posture. |
| DEC-009 | Public facts are server-first and independent of WebGL/LLM/semantic search. | Protects crawlability, accessibility, resilience, and trust. | UX-001, SEO-002, P1-SEO-002 | Raw HTML/no-JS/fallback tests. | None without a new architecture decision. |
| DEC-010 | Paid links are qualified; public-record and RERA sources are not implied endorsers. | Protects legal and search-policy compliance. | LEG-001, P1-OFF-001 | Legal approval and disclosure evidence. | Policy or contract review changes permitted use. |
| DEC-011 | Requirements and contracts use stable IDs and acceptance evidence. | Makes AI and human implementation auditable. | GOV-002, GOV-010, P1-GOV-001 | Requirement/contract/matrix links. | Governance owner approves a new registry model. |

## Change procedure

A proposed change must state affected decision IDs, requirement IDs, work IDs, contracts, legal gates, migration impact, evidence, rollout plan, and reversal trigger. The change is not active until the normative document and supersession manifest are updated.
