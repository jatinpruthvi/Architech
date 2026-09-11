# config/ — Machine-readable operational contracts

Everything here is **read by scripts and tests** (not by humans first). Moving or
renaming anything in this tree requires updating its consumers — see the consumer
map below. Human documentation lives in `docs/`.

## Layout & consumers

| Path | What | Read by |
|---|---|---|
| `governance/environments/` | Environment matrices | `scripts/operations/environment-audit.mjs`, `provisioning-smoke.mjs`, `client/src/lib/operations/environment.test.ts` |
| `governance/secrets/` | Secret inventory (names, never values) | `scripts/operations/secrets-audit.mjs`, provisioning smoke + tests |
| `governance/operations/` | Operational readiness config | `scripts/operations/readiness-audit.mjs` + test |
| `governance/release/` | Release evidence, enablement plan | `scripts/release/*` + `client/src/lib/release/*.test.ts` |
| `governance/legal/gates/` | Legal publication gates (evidence paths verified on disk) | `scripts/security/legal-gate-audit.mjs` |
| `governance/contracts/` | Domain contracts, requirements, implementation matrix | humans + doc tooling |
| `governance/decisions/`, `feedback/`, `CHANGELOG.md` | Governance process records | humans |
| `data/location/` | LGD / India Post reference snapshots | `client/src/lib/location/india-states.ts` (relative import!), `client/src/lib/interop/`, `scripts/location/*` |
| `performance/budgets.json` | JS/CSS/perf budgets | `scripts/performance/budget.mjs`, `pnpm test:perf` |
| `seo/search-console.config.json` | GSC audit config | `scripts/seo/search-console-audit.mjs` |

## Rules

- Contract JSONs reference repo paths as evidence (e.g. legal gates →
  `docs/seo/authority/…`). If you move a doc that is cited as evidence, update the
  citing JSON in the same commit.
- Secret values never belong here — inventories list names/owners/status only.

## See also

Root `AGENTS.md`; `scripts/AGENTS.md` for the audit tooling.
