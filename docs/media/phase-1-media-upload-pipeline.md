# Phase 1 Media Upload Pipeline Contract

**Date:** 24 Aug 2026 (updated 2026-09-05 — R2 path live)  
**Workstream:** `P1-MEDIA-001`

This slice defined the signed upload, derivative, EXIF, media-rights, and moderation contract. The storage wiring has since landed per `media-storage-decision.md`: `ARCHITECH_MEDIA_STORAGE=memory` keeps the in-memory contract (dev default); `r2` signs real uploads to Cloudflare R2.

## API contracts

```text
POST /api/media/uploads/sign
POST /api/media/uploads/{uploadId}/complete
POST /api/admin/media/{uploadId}/moderate
```

## Current behavior

The sign endpoint validates (in both modes):

- listing draft ID
- file name
- allowed MIME type
- max size
- license evidence
- media-rights confirmation
- **media kind gate** (`ARCHITECH_MEDIA_KINDS`, default `images`: `video/*` is refused with a 400 — video code retained, see policy.ts)
- **per-listing quota** (`MEDIA_MAX_IMAGES_PER_LISTING`, default 10 non-deleted items per draft)

It returns a signed upload record with:

- upload URL — **real SigV4-presigned PUT** to R2 (15 min, host-bound) in r2 mode; the memory-mode contract URL in dev
- required headers
- expiry
- EXIF stripping policy
- planned derivatives — mapped to Cloudflare Image Transformations URLs (`<origin>/img/<width>-auto/<key>`) in r2 mode
- moderation status
- audit trail

## Derivatives

Images plan:

- original
- full WebP
- 800px WebP
- thumbnail

Videos plan:

- original
- thumbnail
- HLS manifest

In r2 mode the resized variants are served on demand by Cloudflare Image Transformations (no pre-generated derivative bytes); `hls` stays `planned` until a video provider is chosen.

## Production handoff (remaining)

1. ~~R2 signed upload URL creation~~ — done (`lib/media/sigv4.ts`)
2. malware/MIME validation worker — pending (B-17)
3. EXIF stripping job — pending (B-17); publish gate refuses approved-but-unprocessed media
4. ~~derivative generation job~~ — replaced by edge transformations (on demand)
5. Cloudflare Stream/HLS for video — deferred (video gate closed)
6. ~~Prisma `PropertyMedia` writes~~ — done (including `objectKey` for object deletion)
7. ~~moderation queue state changes~~ — done
8. ~~deletion/takedown workflow~~ — done (row + R2 object; sweep + cron endpoint)

## Validation

```bash
pnpm test -- client/src/lib/media/upload.test.ts
pnpm check
pnpm lint
pnpm test
pnpm build
```
