# Architech Supersession Manifest

## Normative source

`architecture/normative/final-three-phase-architecture.md` is the single normative architecture document. `governance/contracts/REQUIREMENTS.md`, `governance/contracts/DOMAIN-CONTRACTS.md`, `governance/contracts/IMPLEMENTATION-MATRIX.md`, `governance/decisions/DECISION-LOG.md`, and `governance/legal/LEGAL-GATES.md` are normative supporting documents. If two normative documents conflict, the conflict is recorded in `DECISION-LOG.md` and resolved by the technology/product owner before implementation continues.

## Historical documents

The following files are preserved for decision history and must not be used as independent current specifications:

```text
planning/plan.md
history/recommendations/recommendation-v1.md
history/recommendations/recommendation-v2.md
history/recommendations/recommendation-v3.md
history/recommendations/recommendation-v4.md
history/recommendations/recommendation-v5.md
history/recommendations/recommendation-v6.md
history/recommendations/recommendation-v7.md
history/recommendations/recommendation-v8.md
history/reviews/final-technical-stack-review.md
planning/three-phase-execution-appendix.md
history/reviews/v7-feedback-decision-report.md
history/appendices/v7-accepted-feedback-appendix.md
seo/execution/v8-seo-feedback-decision-report.md
history/appendices/v8-accepted-seo-appendix.md
```

## Current supporting documents

| Document | Role |
|---|---|
| `README.md` | Project entry point, reading order, principles, and document map. |
| `architecture/normative/final-three-phase-architecture.md` | Normative architecture and three-phase plan. |
| `governance/contracts/REQUIREMENTS.md` | Stable requirement IDs and acceptance evidence. |
| `governance/contracts/DOMAIN-CONTRACTS.md` | Executable domain boundaries and invariants. |
| `governance/contracts/IMPLEMENTATION-MATRIX.md` | Work IDs, owners, dependencies, estimates, entry/exit criteria, and evidence. |
| `governance/decisions/DECISION-LOG.md` | Decisions, rationale, integration location, evidence, and reversal triggers. |
| `governance/legal/LEGAL-GATES.md` | Required legal and compliance approvals. |
| `governance/feedback/FEEDBACK-REVIEW.md` | Classification and resolution of the attached governance suggestions. |
| `ARCHIVE_INDEX.md` | Historical archive index. |

## Reading order for humans and AI systems

1. Read `README.md`.
2. Read `governance/feedback/FEEDBACK-REVIEW.md` to understand the governance decisions.
3. Read `architecture/normative/final-three-phase-architecture.md` for the complete architecture.
4. Read `governance/contracts/REQUIREMENTS.md` and `governance/contracts/DOMAIN-CONTRACTS.md` before designing data or API behavior.
5. Read `governance/contracts/IMPLEMENTATION-MATRIX.md` before creating tasks.
6. Read `governance/decisions/DECISION-LOG.md` and `governance/legal/LEGAL-GATES.md` before changing a decision or releasing regulated functionality.
7. Consult historical versions only to understand why a decision evolved.

## Supersession rule

A new recommendation version is not automatically normative. To change the architecture, create or update a decision ID, describe the affected requirement/work IDs, record evidence and reversal conditions, update the normative document, and add the change to this manifest.
