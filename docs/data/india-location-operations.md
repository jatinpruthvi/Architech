# India location snapshot operations

**Owner:** data/platform operations
**Last reviewed:** 2026-08-30
**Scope:** official India Post PIN/post-office directory and LGD local-body/PIN crosswalk

This is the production runbook. The public location directory must remain fail-closed until the final audit passes. “Nationwide reference coverage” never means nationwide property inventory or a nationwide catalogue of colloquial neighbourhoods.

## 1. Preconditions

- A current, independently authorized `DATA_GOV_IN_API_KEY` is available as an operations secret. Never put it in a command transcript, manifest, `.env` committed to Git, ticket, or chat.
- `DATABASE_URL` points to the intended PostgreSQL environment.
- PostGIS is installed and `corepack pnpm db:migrate` has applied:
  - `202608300002_india_location_foundation`
  - `202608300003_official_lgd_state_registry`
- The database has a tested backup/restore point.
- The exact OGD distributions and GODL-India use have current legal/data-owner approval.
- Raw snapshots, manifests, reports, and rejection files have approved encrypted/versioned object-storage locations. They do not belong in Git.

Check the tooling before touching production:

```bash
corepack pnpm location:import:test
corepack pnpm db:generate
corepack pnpm check
```

## 2. Fetch immutable official snapshots

The fetcher talks only to two allowlisted `api.data.gov.in` resource IDs, validates publisher/title/schema/status/count, fetches every page, detects publication changes during pagination, computes SHA-256, and writes a provenance manifest. The key is never logged or persisted.

```bash
# Convenience names write under ignored tmp/location/.
DATA_GOV_IN_API_KEY="$DATA_GOV_IN_API_KEY" corepack pnpm location:fetch:india-post
DATA_GOV_IN_API_KEY="$DATA_GOV_IN_API_KEY" corepack pnpm location:fetch:lgd
```

Equivalent explicit commands, useful for date/version-specific filenames:

```bash
corepack pnpm location:fetch:ogd -- \
  --resource india-post \
  --output tmp/location/india-post-YYYY-MM-DD.csv \
  --manifest tmp/location/india-post-YYYY-MM-DD.manifest.json

corepack pnpm location:fetch:ogd -- \
  --resource lgd-local-bodies \
  --output tmp/location/lgd-local-bodies-YYYY-MM-DD.csv \
  --manifest tmp/location/lgd-local-bodies-YYYY-MM-DD.manifest.json
```

Immediately copy each CSV and its manifest as an immutable pair to approved object storage. Record the object version, encryption/retention policy, operator, approval, and import ticket. Do not hand-edit a generated manifest: importers bind the byte checksum and all allowlisted publisher/resource/licence fields.

Expected minimums (these are rejection gates, not promises about future government totals):

| Snapshot | Rows | Jurisdictions | Other minimum |
|---|---:|---:|---:|
| India Post | 150,000 | 35 | 18,000 unique PINs |
| LGD local body/PIN | 4,000 | 30 | 3,000 bodies and 3,000 unique PINs |

## 3. Dry-run and review

Dry-run needs no database and never mutates production.

```bash
corepack pnpm location:import:india-post -- \
  --file tmp/location/india-post.csv \
  --manifest tmp/location/india-post.csv.manifest.json \
  --report tmp/location/india-post-report.json \
  --rejects tmp/location/india-post-rejections.json \
  --warnings tmp/location/india-post-quality-warnings.json

corepack pnpm location:import:lgd -- \
  --file tmp/location/lgd-local-bodies.csv \
  --manifest tmp/location/lgd-local-bodies.csv.manifest.json \
  --report tmp/location/lgd-local-body-import-report.json \
  --rejects tmp/location/lgd-local-body-rejections.json
```

Review and approve all of the following:

1. checksum and record count equal the generated manifest;
2. no publisher, resource ID, field-order, licence, or attribution drift;
3. all state labels resolve to the 36-entry official LGD registry;
4. rejected rows are zero, or every rejection has a documented disposition;
5. counts by State/UT, PIN, office type, and local-body type are plausible versus the prior successful snapshot;
6. additions/removals and material name/code changes are sampled across the country;
7. quality warnings concern only unusable coordinate pairs—the importer keeps the postal row and nulls unsafe coordinates;
8. output reports are archived next to the immutable source pair.

A dry-run with rejected rows intentionally exits with code 2. Coordinate-quality warnings are non-fatal but must still be reviewed. `--allow-rejections` is an explicit exception, not a normal scheduled-import flag.

## 4. Apply

First import into a production-like database and run the complete application test/build suite. Then apply to production during a monitored change window.

```bash
# Initial/idempotent upsert; absent old rows are not retired.
corepack pnpm location:import:india-post -- \
  --file tmp/location/india-post.csv \
  --manifest tmp/location/india-post.csv.manifest.json \
  --report tmp/location/india-post-apply-report.json \
  --apply

corepack pnpm location:import:lgd -- \
  --file tmp/location/lgd-local-bodies.csv \
  --manifest tmp/location/lgd-local-bodies.csv.manifest.json \
  --report tmp/location/lgd-local-body-apply-report.json \
  --apply
```

An India Post apply without the controlled manifest is refused. A failed apply records a failed `LocationImportRun`; because upserts are idempotent, investigate and retry the same immutable pair rather than modifying source bytes.

### Replacing a full previous snapshot

Normal apply is additive/safe. Use replacement only when reviewers have confirmed that the artifact is the complete national successor and have approved deletion/retirement deltas:

```bash
corepack pnpm location:import:india-post -- \
  --file tmp/location/india-post.csv \
  --manifest tmp/location/india-post.csv.manifest.json \
  --apply --replace-full-snapshot

corepack pnpm location:import:lgd -- \
  --file tmp/location/lgd-local-bodies.csv \
  --manifest tmp/location/lgd-local-bodies.csv.manifest.json \
  --apply --replace-full-snapshot
```

Replacement is completeness-gated. It retires absent records with validity timestamps; it does not delete history. Never use it for a circle-only, state-only, truncated, manually filtered, or sample export.

## 5. Audit and activate

```bash
corepack pnpm location:coverage:audit
```

This command exits non-zero unless all state, postal, local-body, freshness, provenance, and “no import currently running” gates pass. `--allow-incomplete` is for diagnosis only and must not be used as a release gate.

After a successful audit:

1. set `ARCHITECH_DATA_SOURCE=prisma` in the production application;
2. deploy/restart without changing the snapshot;
3. verify:
   - `GET /api/locations/status`
   - `GET /api/locations/states`
   - `GET /api/locations/states/gujarat/local-bodies?page=1`
   - several golden `GET /api/locations/postal-codes/{PIN}` requests across postal circles;
   - `/locations/`, one State/UT page, and one exact PIN page;
4. confirm `/locations/` says **National snapshot active** and that active property inventory is still stated separately;
5. verify source URLs, retrieval dates, checksums, GODL attribution, and no Ministry/Department endorsement claim;
6. retain the audit output with the deployment evidence.

The application gates currently require India Post retrieval within 45 days and LGD retrieval within 90 days. The scheduled audit should run daily; source-fetch/import cadence should follow upstream publication (normally monthly) with alerts before either age limit.

## 6. Rollback and incident response

- Stop new import jobs and leave `ARCHITECH_DATA_SOURCE=prisma` only if the last known-good database still passes the audit.
- For an incomplete/corrupt activation, switch the public application away from Prisma-backed national discovery or restore the pre-change database checkpoint; do not mask the failing audit.
- To restore logical source state without a database restore, dry-run and then reapply the exact prior immutable CSV/manifest pair with `--replace-full-snapshot`; expect freshness to fail if that source has aged beyond policy.
- Preserve failed `LocationImportRun`, reports, source objects, and audit output for root-cause review.
- Rotate the OGD key only if exposure is suspected; it must never appear in importer output.

## 7. Data boundaries

- `PostalCode` is a six-digit routing area.
- `PostOffice` is an India Post facility/label.
- `AdministrativeArea` `LOCAL_BODY` is an LGD entity with a stable official code.
- `AdministrativeAreaPostalCode` is the sourced LGD association.
- `Locality` and `LocalityPostalCode` remain separately reviewed product concepts.
- Boundaries/centroids are not fabricated from PIN labels. Geometry stays absent until an exact, licensed official artifact is acquired and validated.
- National location reference coverage must never be presented as national live-listing, RERA, price, statutory-rate, or colloquial-locality coverage.
