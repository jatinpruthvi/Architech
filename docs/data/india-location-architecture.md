# India-wide location architecture and readiness review

**Status:** Accepted foundation; production data activation is gated
**Reviewed:** 2026-08-30
**Scope:** property discovery, listing intake, requirements, search, SEO, maps, RERA, statutory estimates, and location-data operations

## Executive decision

Architech must **not use a PIN code as the locality primary key**.

Persist a property location as a set of related, independently sourced facts:

1. immutable `City.id` and `Locality.id` (the product/search identities);
2. exact six-digit `PostalCode.code`, linked many-to-many through `LocalityPostalCode`;
3. zero or more `PostOffice` records for postal delivery context;
4. versioned `AdministrativeArea` codes/geometry (state/UT, district, subdistrict, local body, ward, village);
5. private exact latitude/longitude when legitimately collected;
6. optional DIGIPIN derived from that exact coordinate;
7. a declared geocode precision and public-coordinate visibility; and
8. provenance, retrieval date, version/checksum, confidence, and review state.

A PIN is useful for address completion and consistency checks. It is not a neighbourhood, municipal boundary, unique post office, or exact point. One product locality can span PINs and one PIN can serve several localities. Colloquial locality names also change independently of postal and administrative names.

## Identity model

| Concept | Canonical identity | Cardinality / purpose | Never assume |
|---|---|---|---|
| Product city | `City.id`; public `slug` | Search/SEO scope; a metro can intersect several local bodies | city = district or post town |
| Product locality | `Locality.id`; `(cityId, slug)` | Neighbourhood users search for; editorially reconciled | locality name = post-office name |
| Postal code | six-digit `PostalCode.code` | Delivery-routing area and filter | one PIN = one locality/city |
| Post office | `(sourceId, sourceRecordId)` | Named delivery facility; many offices can share a PIN | last three digits globally identify one office forever |
| Administrative area | source code + type + validity | State/UT, district, subdistrict, ULB, ward, village | boundaries/names never change |
| Address point | private coordinates + precision | Building/entrance/parcel when evidence permits | geocoder result is exact without precision metadata |
| DIGIPIN | derived ten-character code | Approximately 4 m coordinate cell under current India Post scheme | postal address, ownership, locality, or public-safe location |

Names are attributes, not identifiers. `LocalityAlias` stores language, script, alias type, normalized search form, and source. Do not overwrite an old identity on rename/merge/split: retire/version it and maintain explicit redirects/crosswalks.

## Schema implemented in this repository

`prisma/schema.prisma` and migration `202608300002_india_location_foundation` add:

- `LocationSource` and `LocationImportRun` for license/provenance and reproducible imports;
- hierarchical, versionable `AdministrativeArea` with PostGIS centroid/boundary;
- many-to-many `CityAdministrativeArea` and `LocalityAdministrativeArea` links (metros do not always fit one government unit);
- `LocalityAlias`;
- `PostalCode`, `PostOffice`, and `LocalityPostalCode`;
- normalized `Requirement` and `RequirementLocality` records;
- listing PIN FK, DIGIPIN, coordinate precision, public coordinates, and visibility;
- transitional `Locality.aliases`, `Locality.pincodes`, and `City.pincodePrefixes` fields so existing fixture reads can migrate safely.

The migration enables PostGIS. Managed-database provisioning must install `postgis` before deploy if the application migration role cannot create extensions.

### Constraints that matter

- PIN is `VARCHAR(6)` and checked against `^[1-9][0-9]{5}$`.
- locality ↔ PIN is many-to-many and carries source, confidence, evidence, validity, and primary-link metadata;
- post-office identity is source-scoped and imports are idempotent;
- coordinate pairs must be both present or both absent;
- DIGIPIN uses the current continuous ten-character approved alphabet;
- requirement localities are FK rows, not JSON display names;
- exact coordinates and public approximate coordinates are separate fields.

## Resolution behavior

### PIN lookup

1. Validate exactly six digits, first digit non-zero.
2. Query exact `PostalCode.code` only.
3. Return all active post offices and reviewed `LocalityPostalCode` links.
4. Return source/retrieval metadata and an `ambiguous` flag.
5. If there is no exact row, return “no reviewed mapping”; do **not** infer a city from the first three digits.

The first three digits are postal sorting metadata. They remain useful for audits and aggregate routing, but not for assigning an arbitrary PIN to Mumbai, Ahmedabad, or another city. The fixture resolver and `/api/locations/postal-codes/[code]` now follow this rule.

### Listing intake

The write contract requires `citySlug`, `localitySlug`, and a six-digit `postalCode`. The API resolves slugs to immutable IDs and checks the locality belongs to the city and that the reviewed locality↔PIN link exists. A mismatch is not silently “fixed”; it enters location review because either the submission or the crosswalk may be wrong.

### Requirement intake

The API accepts `citySlug` and `localitySlugs`, never display labels. In Prisma mode it resolves both to IDs under one city and creates `RequirementLocality` rows. Phone digits are AES-256-GCM encrypted with `ARCHITECH_CONTACT_ENCRYPTION_KEY`; only last four digits are separately retained for masked display. Retention defaults to 180 days. `pnpm privacy:requirements:purge` is dry-run by default; production must schedule `pnpm privacy:requirements:purge -- --apply` at least daily and alert when eligible and deleted counts diverge.

### Coordinates and DIGIPIN

`client/src/lib/location/digipin.ts` is a local implementation of the Department of Posts reference algorithm. It avoids a third-party geocoder call and has a published reference-vector test.

Use DIGIPIN only when Architech already has a legitimate coordinate. Store both the coordinate and precision/provenance because DIGIPIN is derived and its scheme may version. Exact coordinates and full DIGIPIN must be private for occupied homes. Public pages should normally show a reviewed locality centroid or coarse/street approximation; never expose a deterministic 4 m cell while claiming the exact address is private.

## Candidate India-wide data sources

No single open dataset supplies all postal, colloquial locality, administrative, and precise address facts. Use a source portfolio and retain each license independently.

| Source | Useful for | Strengths | Limitations / gate |
|---|---|---|---|
| [India Post PIN code list](https://www.indiapost.gov.in/rti/pincodelist) | Official post-office/PIN evidence | First-party Department of Posts source; current site publishes circle lists | Current delivery is often circle PDFs, not one stable machine feed. Confirm reuse terms for each distribution; PDFs require a separately tested parser and human reconciliation. |
| [OGD All India Pincode Directory catalog](https://www.data.gov.in/catalog/all-india-pincode-directory-through-webservice) | Circle, region, division, office, PIN, office type, delivery, district, state | Government OGD catalog; historically machine-readable and published under NDSAP/GODL context | As reviewed, catalog/resource APIs intermittently return missing/zero-byte resources. Never make the production build depend on an undocumented endpoint; archive an approved snapshot/checksum and monitor availability. |
| [Local Government Directory](https://lgdirectory.gov.in/) | Official state, district, subdistrict, village, local-body and ward codes/hierarchy; change history | Correct backbone for government administrative joins | Not a colloquial urban-neighbourhood directory. Portal download formats can change; preserve codes, effective dates, and government-order metadata. |
| [Survey of India Online Maps](https://onlinemaps.surveyofindia.gov.in/AboutPortal.aspx) | Official administrative boundary products | Appropriate reference for political/administrative boundaries | Product-specific access, registration, price, and use conditions vary. Legal review the exact product; “viewable” does not mean bulk-republishable. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) / regional extracts such as [Geofabrik](https://download.geofabrik.de/asia/india.html) | Neighbourhood/place names, multilingual aliases, roads, POIs, approximate boundaries/centroids | Broad India coverage, frequent updates, ODbL, source timestamps | Community data is uneven and not postal authority. Comply with ODbL attribution/share-alike obligations. Do not use the public Nominatim service for bulk import or production autocomplete. |
| [Census of India](https://censusindia.gov.in/census.website/data/census-tables) town/village directories | Census codes, historical settlement names and demographic context | National government reference | Primarily Census 2011 geography until newer compatible releases are published; do not present it as current locality or price data. |
| [India Post DIGIPIN](https://www.indiapost.gov.in/digipin) and [reference code](https://github.com/INDIAPOST-gov/digipin) | Deterministic precise coordinate code | First-party algorithm; offline encode/decode | Requires exact coordinates; not a PIN/locality replacement and creates address privacy risk. Track algorithm/version/license notice. |

Third-party PIN polygon repositories can help QA or bootstrap a review queue, but most polygons are inferred rather than official delivery boundaries. They must not become the canonical locality or silently raise confidence.

## Import and reconciliation pipeline

The controlled pipeline is documented in [`india-location-operations.md`](./india-location-operations.md). It has three fail-closed stages:

1. `scripts/location/fetch-ogd-snapshot.mjs` downloads every page from one of two allowlisted OGD resource IDs, detects source changes during pagination, and writes the exact CSV plus a SHA-256/provenance manifest;
2. `scripts/location/import-india-post.mjs` validates and imports official postal-code/post-office evidence; and
3. `scripts/location/import-lgd-local-bodies.mjs` validates and imports official LGD local-body identities and `AdministrativeAreaPostalCode` associations.

```bash
# Fetch current national snapshots (requires an independently authorized secret).
corepack pnpm location:fetch:india-post
corepack pnpm location:fetch:lgd

# Safe default: full dry-run, no database mutation.
corepack pnpm location:import:india-post -- \
  --file tmp/location/india-post.csv \
  --manifest tmp/location/india-post.csv.manifest.json
corepack pnpm location:import:lgd -- \
  --file tmp/location/lgd-local-bodies.csv \
  --manifest tmp/location/lgd-local-bodies.csv.manifest.json

# Apply only the exact reviewed manifest-bound snapshots.
corepack pnpm location:import:india-post -- \
  --file tmp/location/india-post.csv \
  --manifest tmp/location/india-post.csv.manifest.json --apply
corepack pnpm location:import:lgd -- \
  --file tmp/location/lgd-local-bodies.csv \
  --manifest tmp/location/lgd-local-bodies.csv.manifest.json --apply

# This is the release gate, not merely a dashboard query.
corepack pnpm location:coverage:audit
```

The importers:

- default to dry-run and write machine-readable summary/rejection reports outside Git;
- bind source bytes to a generated manifest and revalidate allowlisted resource, publisher, schema, URL, licence, checksum, and count fields;
- normalize jurisdictions only through official LGD codes/explicit aliases, never PIN-prefix guessing;
- require production completeness thresholds before a controlled national snapshot can activate;
- keep otherwise valid postal rows when coordinates are missing/malformed, but null the unsafe pair and emit a separate quality-warning report;
- record source URL, licence/attribution, publication/retrieval times, version/checksum, and import counters;
- upsert source-scoped identities idempotently;
- never create `City` or `Locality` rows from post-office or LGD labels; and
- retire missing records only for an explicitly approved, completeness-gated `--replace-full-snapshot` apply.

Before each apply, archive the immutable CSV/manifest pair in approved versioned object storage; scan it; inspect schema and national distribution drift; sample every represented jurisdiction; review all rejections/warnings; and approve retirement deltas. A circle/state/sample export is never eligible for replacement.

### Locality reconciliation

Postal import deliberately stops before locality creation. A separate reviewed job should propose links using multiple signals:

- normalized multilingual name/alias match;
- city/admin-area containment;
- post-office and PIN overlap;
- OSM geometry/centroid proximity;
- listing-address evidence; and
- manual editorial decision for conflicts.

Suggested confidence policy:

- `1.000`: manually reviewed with authoritative/spatial evidence;
- `0.800–0.999`: multi-source deterministic match, queued for review;
- `0.500`: current fixtures/manual assertion without authoritative reconciliation;
- below `0.800`: never auto-publish as an exact locality mapping.

Keep rejected and ambiguous candidates. Do not force one match merely to complete a city.

## India-wide application audit

| Area | Defect found | Change / remaining gate |
|---|---|---|
| PIN search | Unknown exact PIN inherited a city from a three-digit prefix | Exact-only, ambiguity-aware resolution implemented. Database API added. |
| Locality persistence | aliases/PINs were arrays on fixtures | Normalized source, alias, postal, post-office, admin, geometry and import-run models added; legacy arrays remain transitional. |
| Requirement capture | display names were submitted; cross-city combinations passed | city-scoped slug contract/UI and API/DB membership checks implemented. |
| Listing intake | no city or PIN in the form | city-first locality selector and required reviewed PIN implemented. |
| Ownership cost | missing/unknown state received Gujarat rates | listing state is passed; unknown state gets null statutory values and visible explanation. State rules require source/review metadata. |
| RERA | architecture and copy implied Gujarat for India | jurisdiction-routed API/provider and national methodology added; records are keyed by jurisdiction plus registration number; correction/refresh operations require explicit state/UT scope; unsupported states return unavailable. Generated fixtures no longer receive invented RERA badges. Each additional authority still needs a legal-approved adapter. |
| Guides | type and filesystem were Ahmedabad/Gujarat literals | scoped guide model/lookups and dynamic city/state route templates added; old Gujarat method URL redirects. Additional reviewed city content remains editorial work. |
| Public copy/SEO | manifest, Hindi, footer, contact, CSS labels and organization JSON-LD claimed Ahmedabad | national copy applied; fabricated corporate address/coordinates removed. Continue an editorial screenshot/crawl review before launch. |
| Statutory rates | one Gujarat baseline only | no cross-state fallback. Production still needs versioned rule tables for each state/UT, conditions, effective dates, and legal review; until then show unavailable. |
| Inventory | generated data could appear verified | generated RERA badges removed. All generated inventory remains explicitly demo-only and must not be indexed as real supply. |

## Production gates

1. **Data/legal:** approve each exact source distribution and license; save notices and attribution; document ODbL derived-database obligations.
2. **Coverage:** reconcile all live-city localities; publish completeness and ambiguity metrics by state/city rather than one national percentage.
3. **Freshness:** scheduled imports, checksum drift alerts, stale-source thresholds, rollback to prior snapshot, and import-run dashboards.
4. **Geospatial QA:** valid geometry, WGS84/SRID 4326, no self-intersections, point-in-polygon checks, border/disputed-area policy, and Survey of India political-boundary compliance.
5. **Privacy/security:** exact coordinates/DIGIPIN access control and audit; encrypted contacts; key rotation; schedule and monitor the implemented requirement-retention purge; consent/revocation flow; DPDP review.
6. **RERA/rates:** authority adapter and transfer-rule coverage by listing jurisdiction; no badge/number when unavailable; effective date and official source visible.
7. **Product:** replace fixture registries with server-backed selectors/search, while retaining an offline/test fixture adapter only.
8. **Quality:** importer fixture tests, migration test against PostGIS PostgreSQL, idempotent second-run test, sampled golden PINs across every postal circle, cross-city locality tests, and load tests for alias/PIN/spatial indexes.

Until these gates pass, Architech can be architecturally India-wide and honestly demo-scoped, but must not claim complete or authoritative nationwide locality coverage.
