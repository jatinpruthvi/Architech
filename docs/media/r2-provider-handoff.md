# Cloudflare R2 Media Provider Handoff

**Date:** 24 Aug 2026

This slice adds a provider abstraction for moving media uploads from the in-memory contract to Cloudflare R2/Stream.

## Media storage mode

```text
ARCHITECH_MEDIA_STORAGE=memory | r2
```

Default:

```text
memory
```

## Required R2 environment

```text
R2_ACCOUNT_ID=
R2_BUCKET=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=
```

## Provider abstraction

```text
client/src/lib/media/provider.ts
client/src/lib/media/server/upload.ts
```

Implemented providers:

- `MemoryMediaStorageProvider`
- `R2MediaStorageProvider`

The R2 provider signs **real** SigV4 presigned PUT URLs (dependency-free
implementation in `client/src/lib/media/sigv4.ts`, pinned to the AWS IAM
worked example in `sigv4.test.ts`) and deletes objects through a
header-signed DELETE (`deleteObject`). No placeholder signed URL remains.
The images-only gate and the per-listing upload quota
(`docs/media/media-storage-decision.md`, phases 2 + 4) are enforced at the
sign endpoint.

## Production handoff (remaining)

1. Store R2 secrets in platform secret stores.
2. Set `ARCHITECH_MEDIA_STORAGE=r2` + `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` in staging.
3. ~~Replace placeholder signing with SDK presigning~~ — done (SigV4 in-repo).
4. ~~Store `PropertyMedia` rows with object keys and license evidence~~ — done (`objectKey` column, migration `202609050002_property_media_object_key`).
5. Run MIME/malware validation worker — pending (B-17).
6. Strip EXIF and generate derivatives — pending (B-17); the publish gate refuses approved-but-unprocessed media until then.
7. Make only approved media public — enforced by `isPublishable` (approved + EXIF stripped).
8. Enable Image Transformations on the R2 bucket domain so the `next/image` loader's `/img/<width>-auto/` URLs resolve.
9. Optionally drive the retention sweep from a platform cron
   (`POST /api/internal/scheduled/media-retention-sweep/`, `CRON_SECRET`) and
   set `MEDIA_RETENTION_SWEEP=off` when the cron is live.
