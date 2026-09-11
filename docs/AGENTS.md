# docs/ — All human documentation

Everything non-code lives here. Nothing documentation-related belongs at the repo
root except `README.md` and `AGENTS.md`.

## Find things fast

1. `MARKDOWN-DOCUMENTATION-INDEX.md` (this folder) — generated index of every
   markdown file, categorized. Regenerate with `node ops/scripts/generate-md-index.mjs`
   after adding/moving docs.
2. Root `AGENTS.md` routing table — task → folder.

## Categories

| Folder | Contents |
|---|---|
| `architecture/` | Normative architecture (`normative/final-three-phase-architecture.md` is the source of truth) |
| `planning/` | STATUS.md, phase plans, todo/blocker/ideas, motion review |
| `specs/` | Feature specifications |
| `guides/` | How-to and workflow guides |
| `product/` | Feature/agent inventories (addressbox-*) |
| `audits/` | Dated audits (`2026-08/`), improvement reviews |
| `findings/` | Debugging/investigation findings |
| `research/` | Competitor and open-source research |
| `ui/` | Theme and design-surface docs |
| `seo/` | SEO strategy: `authority/`, `execution/`, plus per-topic docs |
| `data/` | Data-provider docs (Hozn field mapping, India Post/LGD resources) |
| `history/` | Frozen recommendation versions (v1–v8), reviews, appendices — historical record, not guidance |
| `archive/` | Superseded material incl. `template.json` (dead scaffolding artifact) |
| `superpowers/` | Design specs + implementation plans from the superpowers workflow |
| Topic folders (`auth/`, `broker/`, `leads/`, `security/`, `operations/`, …) | Domain documentation |

## Rules

- Machine-readable contracts are NOT here — they live in `ops/config/`.
- New doc → pick the matching category above; add the date in the name for
  point-in-time material (`YYYY-MM-DD-topic.md`).
- Link to sibling docs with repo-relative paths from the repo root.
