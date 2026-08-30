# Location data policy

This directory contains only small, reviewable reference registries that are required to make identity and migration behavior deterministic.

## Included snapshot

`official/lgd-state-ut-2026-08-30.json` is the 36-row State/Union Territory registry published by the Ministry of Panchayati Raj's Local Government Directory. It was retrieved from the LGD citizen report generated on 30 August 2026 and cross-referenced with the OGD LGD catalog.

Attribution: Ministry of Panchayati Raj, 2026, Local Government Directory Codes of States/Union Territories, LGD/OGD Platform India, 30/08/2026, https://lgdirectory.gov.in/globalviewstateforcitizen.do. Published under Government Open Data License - India: https://ap.data.gov.in/godl.

The snapshot checksum is recorded by the data migration that loads it. Architech does not imply Ministry endorsement, and upstream data is provided without warranty.

## Excluded bulk data

India Post post-office snapshots, LGD local-body/PIN snapshots, boundaries, rejection reports, and importer output must **not** be committed. Keep immutable raw files and manifests in approved versioned object storage; local tooling writes under ignored `tmp/location/`. Database rows retain publisher, source URL, retrieval time, version, checksum, and import-run counters.

Fetch, dry-run, apply, replacement, audit, rollback, and attribution procedures are documented in [`../../docs/data/india-location-operations.md`](../../docs/data/india-location-operations.md).
