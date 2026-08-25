# Phase 1 Media Upload Pipeline Contract

**Date:** 24 Aug 2026  
**Workstream:** `P1-MEDIA-001`

This slice defines the signed upload, derivative, EXIF, media-rights, and moderation contract without connecting to Cloudflare R2/Stream yet.

## API contracts

```text
POST /api/media/uploads/sign
POST /api/media/uploads/{uploadId}/complete
POST /api/admin/media/{uploadId}/moderate
```

## Current behavior

The implementation is an in-memory contract that validates:

- listing draft ID
- file name
- allowed MIME type
- max size
- license evidence
- media-rights confirmation

It returns a signed-upload placeholder with:

- upload URL
- required headers
- expiry
- EXIF stripping policy
- planned derivatives
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

## Production handoff

Replace the in-memory store with:

1. R2 signed upload URL creation
2. malware/MIME validation worker
3. EXIF stripping job
4. derivative generation job
5. Cloudflare Stream/HLS for video
6. Prisma `PropertyMedia` writes
7. moderation queue state changes
8. deletion/takedown workflow

## Validation

```bash
pnpm test -- client/src/lib/media/upload.test.ts
pnpm check
pnpm lint
pnpm test
pnpm build
```
