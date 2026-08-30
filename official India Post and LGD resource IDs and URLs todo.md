# TODO: Load official India-wide postal-code and administrative-locality reference data

> **Handoff for a human operator or another AI coding agent**
> Repository: `jatinpruthvi/Architech`
> Working directory: `/home/user/Architech`
> Working branch: `arena/01a052c7-architech`
> Prepared: 2026-08-30 (Asia/Kolkata)

## 1. Objective

Acquire the current official nationwide India Post PIN/post-office snapshot and the current official Local Government Directory (LGD) local-body/PIN snapshot, preserve their provenance, validate them, archive the exact source bytes and manifests, import them into PostgreSQL/PostGIS, and activate database-backed national location discovery only after all completeness and freshness gates pass.

This task is about **official reference coverage**. It must not falsely claim nationwide property-listing or colloquial-neighbourhood coverage.

## 2. Non-negotiable location model

Keep these concepts separate:

1. `PostalCode`: an exact six-digit India PIN routing area.
2. `PostOffice`: an India Post office/facility associated with a PIN.
3. `AdministrativeArea`: an official LGD entity such as State/UT or local body.
4. `AdministrativeAreaPostalCode`: the sourced LGD relationship between an administrative body and a PIN.
5. `City`: an Architech product/search market.
6. `Locality`: a reviewed Architech property neighbourhood or sublocality.
7. `LocalityPostalCode`: a separately reviewed product-locality/PIN relationship.
8. Geometry/coordinates: separately sourced spatial evidence.

**Never:**

- create product `City` or `Locality` rows automatically from post-office or LGD labels;
- infer a State, city, or locality from a PIN prefix;
- assume one PIN means one locality or one city;
- fabricate boundaries or centroids from postal labels;
- use a sample response as a national snapshot;
- use third-party mirrors or credentials found in source code, search engines, URLs, or public posts;
- commit bulk CSV files, manifests containing operational paths, or rejection reports to Git;
- claim nationwide property inventory merely because nationwide postal references are loaded.

## 3. Current repository state

The implementation is prepared, but no nationwide bulk file has been acquired or applied.

### Already implemented

- Official 36-entry LGD State/UT registry:
  - `data/location/official/lgd-state-ut-2026-08-30.json`
  - 28 states and 8 Union Territories
  - SHA-256: `7e1f421512b11b92696364d1ce3508f5da050bd81c1f0f0a9d24b3eaf94d3aa9`
- Controlled OGD downloader:
  - `scripts/location/fetch-ogd-snapshot.mjs`
- India Post importer:
  - `scripts/location/import-india-post.mjs`
- LGD local-body/PIN importer:
  - `scripts/location/import-lgd-local-bodies.mjs`
- Coverage release audit:
  - `scripts/location/audit-coverage.mjs`
- Database schema and migrations:
  - `prisma/migrations/202608300002_india_location_foundation/migration.sql`
  - `prisma/migrations/202608300003_official_lgd_state_registry/migration.sql`
- Exact PIN and location APIs/pages:
  - `/api/locations/postal-codes/{PIN}`
  - `/api/locations/status`
  - `/api/locations/states`
  - `/api/locations/states/{state}/local-bodies`
  - `/locations/`
  - `/locations/{state}/`
  - `/locations/postal-codes/{PIN}/`
- Detailed operations runbook:
  - `docs/data/india-location-operations.md`

The importers keep a source in `STAGING` status until the import run succeeds. Public coverage queries include only `ACTIVE` sources, so a failed or interrupted import must fail closed.

### Current blockers confirmed on 2026-08-30

```text
DATA_GOV_IN_API_KEY=unset
DATABASE_URL=unset
ARCHITECH_DATA_SOURCE=unset
```

No bulk files currently exist under `tmp/location/`.

Direct HTTPS from this sandbox currently fails for both `api.data.gov.in` and `www.data.gov.in`:

```text
ECONNRESET
Client network socket disconnected before secure TLS connection was established
```

DNS works and resolves `api.data.gov.in`, so the failure occurs during TLS before any API authentication response. It may be sandbox egress policy or upstream blocking of the sandbox network.

## 4. Cost and access

### Is the data free?

Yes, the official OGD data and API-key facility appear free for registered users:

- OGD help: https://www.data.gov.in/help
- Government Open Data License–India: https://ap.data.gov.in/godl

GODL-India grants royalty-free lawful commercial and non-commercial reuse, but requires attribution, source/licence details, non-endorsement, and compliance with its exemptions and conditions.

The portal can enforce authentication and rate limits. Do not interpret “free” as permission to reuse another person’s API key.

### Access required for fetching

Use one of these approved paths.

#### Path A — authorized API access

A human should:

1. register/login at https://www.data.gov.in/;
2. generate/request an API key through the registered-user account;
3. configure it in the secure Arena/runtime secret manager as:

   ```text
   DATA_GOV_IN_API_KEY
   ```

4. never paste the key into chat, a ticket, a command argument, Git, a manifest, or a report;
5. arrange outbound HTTPS access to:

   ```text
   api.data.gov.in:443
   www.data.gov.in:443
   ```

If the TLS reset remains, use Path B rather than weakening source checks.

#### Path B — attach original official exports

A human may download the two original CSV exports from the official resource pages in their own browser and attach them to the task/workspace.

Requirements:

- attach the original bytes without editing or resaving in Excel;
- include the official resource URL, original filename, and retrieval timestamp;
- if available, attach the API metadata/manifests generated during the same download;
- do not provide a mirror, old GitHub dataset, Kaggle file, or manually combined spreadsheet.

An attached file without independently verifiable official metadata may be inspected and checksummed, but production apply must remain blocked until provenance is approved. Do not disable the manifest validator to force an import.

### Access required for archive

The user selected **local workspace staging only** for now. No cloud-storage credential is required for that limited step.

Local staging is not a durable production archive. A final production run should eventually use an approved private, encrypted, versioned S3/GCS/Azure-compatible location or another reviewed immutable store. Cloud storage may have a small provider charge even though the government data itself is free.

## 5. Exact official resources

### A. India Post nationwide directory

- Logical name: `All India Pincode Directory till last month`
- Publisher: Department of Posts, Ministry of Communications, Government of India
- Resource ID: `5c2f62fe-5afa-4119-a499-fec9d604d5bd`
- Resource page: https://www.data.gov.in/resource/all-india-pincode-directory-till-last-month
- Catalog: https://www.data.gov.in/catalog/all-india-pincode-directory-through-webservice
- API: `https://api.data.gov.in/resource/5c2f62fe-5afa-4119-a499-fec9d604d5bd`
- Displayed resource-page update when this handoff was written: 10/08/2026
- Granularity: monthly
- Last independently observed API total before this handoff: 165,627 rows; reconfirm during the real fetch
- Approved field order:

  ```text
  circlename
  regionname
  divisionname
  officename
  pincode
  officetype
  delivery
  district
  statename
  latitude
  longitude
  ```

### B. LGD local-body/PIN crosswalk

- Logical name: `Local Government Directory (LGD) - Local Bodies with PIN Codes`
- Publisher: Ministry of Panchayati Raj, Government of India
- Resource ID: `71818d1a-c114-46cb-aa9b-56ed70d4bc4a`
- Resource page: https://www.data.gov.in/resource/local-government-directory-lgd-local-bodies-pin-codes
- Catalog: https://www.data.gov.in/catalog/local-government-directory-lgd
- API: `https://api.data.gov.in/resource/71818d1a-c114-46cb-aa9b-56ed70d4bc4a`
- Displayed resource-page update when this handoff was written: 30/08/2026
- Granularity: monthly
- Last independently observed API total before this handoff: 7,411 rows; reconfirm during the real fetch
- Approved field order:

  ```text
  stateCode
  stateNameEnglish
  localBodyCode
  localBodyNameEnglish
  localBodyTypeName
  pincode
  ```

The page’s displayed “Updated On” date and the API artifact’s own update timestamp can differ. Record both, but use the API metadata bound to the fetched bytes in the manifest. Never invent a publication date.

## 6. Step 1 — fetch current snapshots

Run from `/home/user/Architech` on the fixed working branch.

Use `corepack pnpm`; direct `pnpm` may not be available.

### 6.1 Preflight

```bash
cd /home/user/Architech
umask 077

# Confirm the secret exists without printing its value.
test -n "$DATA_GOV_IN_API_KEY" \
  && echo "DATA_GOV_IN_API_KEY is configured" \
  || { echo "DATA_GOV_IN_API_KEY is missing"; exit 1; }

# Test only endpoint reachability; do not print a key-bearing URL.
curl -sS -I --connect-timeout 10 --max-time 20 https://api.data.gov.in/

corepack pnpm location:import:test
```

If TLS still resets, stop. Ask for network egress or use attached original exports. Do not retry with public/demo/indexed credentials.

### 6.2 Create a date-scoped local staging directory

```bash
SNAPSHOT_DATE="$(date -u +%F)"
ARCHIVE_DIR="tmp/location/archive/${SNAPSHOT_DATE}"
mkdir -p "$ARCHIVE_DIR"
chmod 700 tmp/location tmp/location/archive "$ARCHIVE_DIR"

# Persist only these non-secret path variables for later non-interactive calls.
printf 'SNAPSHOT_DATE=%q\nARCHIVE_DIR=%q\n' \
  "$SNAPSHOT_DATE" "$ARCHIVE_DIR" \
  > tmp/location/current-run.env
chmod 600 tmp/location/current-run.env
```

Do not reuse a directory containing an earlier snapshot. If files already exist, compare and choose a new run-specific suffix rather than overwriting them.

Arena/agent shell state does not persist between separate terminal tool calls. Therefore every later shell call that uses these variables must start with:

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"
```

This fail-closed guard prevents an unset variable from writing to an unintended root-level path.

### 6.3 Fetch India Post

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"

corepack pnpm location:fetch:ogd -- \
  --resource india-post \
  --output "$ARCHIVE_DIR/india-post.csv" \
  --manifest "$ARCHIVE_DIR/india-post.manifest.json" \
  --page-size 1000 \
  --concurrency 2 \
  --delay-ms 100
```

### 6.4 Fetch LGD

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"

corepack pnpm location:fetch:ogd -- \
  --resource lgd-local-bodies \
  --output "$ARCHIVE_DIR/lgd-local-bodies.csv" \
  --manifest "$ARCHIVE_DIR/lgd-local-bodies.manifest.json" \
  --page-size 1000 \
  --concurrency 2 \
  --delay-ms 100
```

The downloader must:

- use only the two allowlisted resource IDs above;
- verify active status, exact title, publisher organization, field order, and approved row-count range;
- follow the API’s actual effective page size;
- download every page;
- verify that total/update metadata did not change between the first and final request;
- atomically write the output;
- calculate SHA-256;
- generate `architech-ogd-snapshot-v1` manifests;
- never log or store the API key.

If the source changes during pagination, discard the mixed result and restart in a new clean run directory.

## 7. Step 2 — verify and locally archive exact bytes

### 7.1 Confirm expected files

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"

test -s "$ARCHIVE_DIR/india-post.csv"
test -s "$ARCHIVE_DIR/india-post.manifest.json"
test -s "$ARCHIVE_DIR/lgd-local-bodies.csv"
test -s "$ARCHIVE_DIR/lgd-local-bodies.manifest.json"
```

### 7.2 Create an archive inventory

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"

(
  cd "$ARCHIVE_DIR"
  sha256sum \
    india-post.csv \
    india-post.manifest.json \
    lgd-local-bodies.csv \
    lgd-local-bodies.manifest.json \
    > SHA256SUMS
  sha256sum --check SHA256SUMS
)
```

The CSV checksum in each manifest must match its corresponding file. `SHA256SUMS` additionally protects the manifests themselves.

### 7.3 Make local staged files read-only

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"

find "$ARCHIVE_DIR" -maxdepth 1 -type f -exec chmod 0444 {} +
ls -lah "$ARCHIVE_DIR"
```

Read-only permissions plus checksums detect accidental changes but are not equivalent to immutable/versioned object storage.

### 7.4 Record an operator note

The archive directory remains writable even though the source files are read-only. Create `$ARCHIVE_DIR/OPERATOR-NOTE.md` with the following fields, fill them with real values, and then make the note read-only:

```text
Operator/person or agent:
Retrieval started at UTC:
Retrieval completed at UTC:
Official India Post resource URL:
Official LGD resource URL:
India Post manifest checksum:
LGD manifest checksum:
Archive location:
Source/legal approval reference:
Any retries or source drift observed:
```

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"
chmod 0444 "$ARCHIVE_DIR/OPERATOR-NOTE.md"
```

Do not include the API key.

### 7.5 Do not put bulk artifacts in Git

Verify:

```bash
git status --short -- tmp/location
```

Expected result: no tracked bulk files. `tmp/` is ignored intentionally.

For production, copy the entire date-scoped directory to an approved versioned encrypted store and record its object version/generation ID. Until that occurs, report archival status as **local staging only — durable archive pending**.

## 8. Required completeness gates

These are minimum rejection/activation gates, not fixed claims about future official totals.

| Dataset | Minimum accepted rows | Minimum represented State/UT count | Other minimums |
|---|---:|---:|---:|
| India Post | 150,000 | 35 | 18,000 unique PINs |
| LGD local-body/PIN | 4,000 | 30 | 3,000 unique local bodies and 3,000 unique PINs |

Additional requirements:

- India Post rows must resolve State/UT labels through the official LGD registry or explicit reviewed historical aliases.
- A malformed/missing coordinate pair is a non-fatal quality warning: keep valid postal coverage but store both coordinates as null.
- Invalid PINs, missing office names, unknown State/UT labels, schema drift, duplicate source identities, and identity conflicts are rejections.
- Missing rows may be retired only during an explicitly approved complete replacement.

## 9. Dry-run after archive

Temporarily make report directories writable if the archive directory itself was locked, or write reports under a separate run directory.

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"

REPORT_DIR="tmp/location/reports/${SNAPSHOT_DATE}"
mkdir -p "$REPORT_DIR"
chmod 700 "$REPORT_DIR"

corepack pnpm location:import:india-post -- \
  --file "$ARCHIVE_DIR/india-post.csv" \
  --manifest "$ARCHIVE_DIR/india-post.manifest.json" \
  --report "$REPORT_DIR/india-post-report.json" \
  --rejects "$REPORT_DIR/india-post-rejections.json" \
  --warnings "$REPORT_DIR/india-post-quality-warnings.json"

corepack pnpm location:import:lgd -- \
  --file "$ARCHIVE_DIR/lgd-local-bodies.csv" \
  --manifest "$ARCHIVE_DIR/lgd-local-bodies.manifest.json" \
  --report "$REPORT_DIR/lgd-local-body-import-report.json" \
  --rejects "$REPORT_DIR/lgd-local-body-rejections.json"
```

A dry-run with rejected rows intentionally exits with status code 2. Do not treat that as a tooling crash. Inspect every rejection. `--allow-rejections` is an explicit reviewed exception and must not become the default.

Archive the reports with the source pair after review.

## 10. Database apply — requires separate access

Fetching and local archival do not require database access. Applying does.

Required environment:

```text
DATABASE_URL=<PostgreSQL/PostGIS connection configured securely>
```

Before apply:

1. use a production-like PostgreSQL database with PostGIS;
2. take/test a backup restore point;
3. run the migrations, including the India location foundation and official 36-State/UT migration;
4. verify no other location import is running;
5. approve all dry-run reports.

```bash
. tmp/location/current-run.env
: "${ARCHIVE_DIR:?ARCHIVE_DIR is not configured}"
REPORT_DIR="tmp/location/reports/${SNAPSHOT_DATE}"

corepack pnpm db:migrate

corepack pnpm location:import:india-post -- \
  --file "$ARCHIVE_DIR/india-post.csv" \
  --manifest "$ARCHIVE_DIR/india-post.manifest.json" \
  --report "$REPORT_DIR/india-post-apply-report.json" \
  --apply

corepack pnpm location:import:lgd -- \
  --file "$ARCHIVE_DIR/lgd-local-bodies.csv" \
  --manifest "$ARCHIVE_DIR/lgd-local-bodies.manifest.json" \
  --report "$REPORT_DIR/lgd-local-body-apply-report.json" \
  --apply
```

Do not use `--replace-full-snapshot` on the initial run. On later runs, use it only after proving the source is a complete national successor and reviewing all retirement deltas.

## 11. Audit and activation

After both applies:

```bash
corepack pnpm location:coverage:audit
```

The command must exit zero. It checks:

- exactly 36 official State/UT records;
- national India Post row/PIN/jurisdiction thresholds;
- national LGD body/link/jurisdiction thresholds;
- required publisher/source/licence/attribution/checksum provenance;
- India Post freshness within 45 days;
- LGD freshness within 90 days;
- no import remaining in `RUNNING` state;
- only successfully activated (`ACTIVE`) sources count toward coverage.

Only after this passes, configure:

```text
ARCHITECH_DATA_SOURCE=prisma
```

Then deploy/restart and verify:

```text
GET /api/locations/status
GET /api/locations/states
GET /api/locations/states/gujarat/local-bodies?page=1
GET /api/locations/postal-codes/380001
GET /api/locations/postal-codes/110001
GET /api/locations/postal-codes/400001
GET /api/locations/postal-codes/560001
GET /api/locations/postal-codes/700001

/locations/
/locations/gujarat/
/locations/postal-codes/380001/
```

Also sample valid PINs across all represented postal circles and inspect each State/UT rather than relying only on the examples above.

## 12. Quality commands another AI must run

At minimum:

```bash
corepack pnpm location:import:test
corepack pnpm check
corepack pnpm lint
corepack pnpm test
corepack pnpm build:ci
```

Prisma validation/generation:

```bash
corepack pnpm db:validate
corepack pnpm db:generate
```

If Prisma cannot download its schema-engine checksum because of TLS, report the network failure rather than treating it as a schema defect. Never substitute `/bin/true` or another fake engine for `prisma migrate deploy`; migration execution requires the real migration engine and real PostgreSQL/PostGIS.

Latest known validation before this handoff:

- TypeScript passed.
- ESLint passed.
- Prisma schema format/validation and client generation passed locally.
- All 15 Node location-script tests passed.
- All 31 focused location/SEO tests passed.
- The latest full Vitest run passed 928 of 929 tests; the only failure was an expected SEO registry count after adding `/locations/`. That expectation was corrected and its focused test now passes. A final full-suite rerun is still required.
- No real PostgreSQL/PostGIS migration or full-snapshot import has run.

## 13. Acceptance checklist

Do not mark this task complete until every applicable item is checked.

### Fetch and provenance

- [ ] Authorized OGD API key configured securely, or original official files attached.
- [ ] Direct official source independently verified.
- [ ] India Post complete CSV acquired.
- [ ] LGD complete CSV acquired.
- [ ] Current API metadata captured for both.
- [ ] Exact field schema verified.
- [ ] CSV checksums generated and matched to manifests.
- [ ] GODL attribution present.
- [ ] No credentials appear in URLs, logs, manifests, reports, Git, or chat.

### Archive

- [ ] Date/run-scoped local archive created.
- [ ] `SHA256SUMS` verifies all four source/manifest files.
- [ ] Operator note created without secrets.
- [ ] Files are outside Git.
- [ ] Local-only limitation reported honestly.
- [ ] For production: encrypted/versioned durable object archive completed and object IDs recorded.

### Validation/import

- [ ] India Post dry-run reviewed.
- [ ] LGD dry-run reviewed.
- [ ] Rejections are zero or individually approved.
- [ ] Coordinate warnings reviewed separately.
- [ ] National count/jurisdiction/PIN gates pass.
- [ ] Migrations applied to real PostgreSQL/PostGIS.
- [ ] Both snapshots applied successfully.
- [ ] Idempotent rerun tested.
- [ ] Coverage audit exits zero.

### Product integrity

- [ ] `ARCHITECH_DATA_SOURCE=prisma` enabled only after audit.
- [ ] Public status/API/page checks pass.
- [ ] Postal labels were not promoted to product localities.
- [ ] LGD local bodies were not promoted to product cities/localities.
- [ ] No PIN-prefix fallback exists.
- [ ] National reference coverage is visibly separate from active property inventory.
- [ ] No geometry completeness is claimed without a verified licensed boundary source.

## 14. Required final report from the operator/AI

Return a concise evidence report containing:

```text
Acquisition method:
Retrieval timestamps:
India Post resource ID:
India Post API update/version:
India Post row count:
India Post unique PIN count:
India Post represented State/UT count:
India Post CSV SHA-256:
India Post manifest SHA-256:

LGD resource ID:
LGD API update/version:
LGD row count:
LGD unique body count:
LGD unique PIN count:
LGD represented State/UT count:
LGD CSV SHA-256:
LGD manifest SHA-256:

Rejection counts:
Coordinate warning count:
Local archive path:
Durable archive URI/object versions, or “pending”:
Database migration result:
India Post import run ID:
LGD import run ID:
Coverage audit result:
Application activation result:
Tests/build result:
Remaining blockers:
```

Never put the API key or database credentials in this report.

## 15. Definition of done

The immediate requested steps are complete only when:

1. both current official nationwide snapshots have been obtained from a first-party source;
2. their exact bytes are checksum-bound to complete provenance manifests;
3. the local archive inventory verifies;
4. durable archival is either completed or explicitly reported as still pending because local-only staging was chosen; and
5. no unsupported claim has been made about property localities, geometry, or live inventory.

The broader production-coverage task is complete only after real PostgreSQL/PostGIS apply, a passing coverage audit, Prisma activation, and public verification.
