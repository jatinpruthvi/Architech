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

The R2 provider currently returns a placeholder signed URL contract until real Cloudflare SDK signing is enabled with production credentials.

## Production handoff

1. Store R2 secrets in platform secret stores.
2. Set `ARCHITECH_MEDIA_STORAGE=r2` in staging.
3. Replace placeholder signing with Cloudflare/AWS S3-compatible SDK presigning.
4. Store `PropertyMedia` rows with object keys and license evidence.
5. Run MIME/malware validation worker.
6. Strip EXIF and generate derivatives.
7. Make only approved media public.
