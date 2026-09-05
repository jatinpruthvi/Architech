# Media Storage Decision — Initial Phase

**Date:** 2026-09-05
**Status:** Decided; implementation phases 1–4 landed (2026-09-05)
**Owner:** Product / Platform

## Summary

For the initial phase of listing media uploads:

- **Images only.** Video upload is *disabled on the user side*, but video support stays in the code behind a config gate so it can be enabled later without a rewrite.
- **Image storage: Cloudflare R2.** Originals are stored once in R2.
- **Image serving: Cloudflare edge transforms.** Serve compressed WebP/AVIF + thumbnails via Cloudflare Image Transformations (remote R2 origin), or a `next/image` loader on R2.
- **Video provider: not selected yet.** Revisit Bunny Stream vs Cloudflare Stream only once revenue justifies video.

We are **not** using Google Cloud Storage, AWS S3, Wasabi, or the hosted Cloudflare Images product in this phase.

## Why R2 (over the alternatives)

| Provider | Storage | Egress | Fit for public listing images |
|---|---|---|---|
| **Cloudflare R2** | ~$0.015/GB | **$0** | Best total cost + built-in edge delivery; simplest public-serving model |
| Backblaze B2 | ~$0.007/GB (cheapest raw) | Free ~3x storage via CF, then ~$0.01/GB | Cheapest bytes, but needs separate CDN pairing |
| Wasabi | ~$0.008/GB | $0 (fair use, 1 TB min, 90-day retention) | Poor fit: high-churn listing media, retention/minimum constraints |
| Google Cloud Storage | ~$0.020/GB | ~$0.08–0.12/GB | Egress erases savings for a public image site |
| AWS S3 | ~$0.023/GB | ~$0.09/GB | Expensive for this workload |

The deciding factor is **public, read-heavy delivery**. R2 has zero egress, so as customer views grow the image bill does not scale with bandwidth.

## Why not hosted Cloudflare Images (yet)

- **R2 + Image Transformations is cheaper at scale** and keeps direct control of original files.
- First **5,000 unique transformations/month are free**, then ~$0.50 per 1,000; R2 storage + reads remain a few dollars at early scale.
- Hosted Cloudflare Images bills **$5 per 100,000 stored images** + **$1 per 100,000 delivered**. Simpler to operate but more cost and less control. Consider later only if we want to stop operating a transform/serving layer.

## Decided architecture

| Layer | Initial choice |
|---|---|
| Upload path | Browser → presigned direct upload to **Cloudflare R2** (server only signs, bytes do not pass through Next.js) |
| Original storage | **Cloudflare R2** |
| Image delivery | Cloudflare edge (custom R2 bucket domain) + **Image Transformations** (auto WebP/AVIF, resize, thumbnails), or `next/image` loader on R2 |
| Video | **Disabled** user-side via config gate; code retained |
| Backend wiring | Repo's `MediaStorageProvider` abstraction, `MemoryMediaStorageProvider` for dev, `R2MediaStorageProvider` for staging/production |

### Env / config

- `ARCHITECH_MEDIA_STORAGE=memory` → local/sandbox (default)
- `ARCHITECH_MEDIA_STORAGE=r2` → staging/production
- `ARCHITECH_MEDIA_KINDS=images` (default) → images-only gate; `all` re-enables the retained video path. UI mirror: `NEXT_PUBLIC_ARCHITECH_MEDIA_KINDS`.
- `MEDIA_MAX_IMAGES_PER_LISTING=10` → per-listing upload quota (non-deleted items per draft).
- `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` → browser-visible twin of `R2_PUBLIC_BASE_URL`; the `next/image` loader needs it client-side to build transformation URLs.

Required env (already in `.env.production.example` / `.env.staging.example`):

```
R2_ACCOUNT_ID
R2_BUCKET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_PUBLIC_BASE_URL
```

## Implementation phases

1. **Finish real R2 presigned signing** — **done.** `client/src/lib/media/sigv4.ts` performs dependency-free SigV4 (pinned to the AWS worked example in `sigv4.test.ts`); `R2MediaStorageProvider.signUpload` returns a 15-minute, host-bound, query-signed PUT URL. No placeholder remains.
2. **Image-only gate** — **done.** `client/src/lib/media/policy.ts` (`ARCHITECH_MEDIA_KINDS`, default `images`) is enforced at the sign endpoint (`server/upload.ts`) and mirrored in the UI (`ListingSubmission.tsx`, `NEXT_PUBLIC_ARCHITECH_MEDIA_KINDS`). The video code path is retained; `all` re-enables it.
3. **Transform/serve layer** — **done (URL scheme).** `client/src/lib/media/image-loader.ts` builds Cloudflare Image Transformations URLs (`<origin>/img/<width>-auto/<key>`); `next.config.ts` activates a `next/image` custom loader (`next-image-loader.ts`) when `ARCHITECH_MEDIA_STORAGE=r2`. The bucket domain must have Image Transformations enabled.
4. **Quotas + lifecycle** — **done (app-side).** Per-listing quota `MEDIA_MAX_IMAGES_PER_LISTING` (default 10) enforced at sign time; the retention sweep and takedown path delete the R2 **object** (not just the DB row) via `MediaStorageProvider.deleteObject` + `PropertyMedia.objectKey`. Bucket-level R2 lifecycle rules for orphaned/long-stale objects are an operator task on the bucket itself.
5. **Video (later)** — **deferred by decision.** Enable only when revenue starts; evaluate Bunny Stream vs Cloudflare Stream through the same provider abstraction.

## Guardrail

- Do **not** delete the existing video code, derivatives, or `hls`/video types. Disable it at the request/UI gate, not by removing it.
- Do **not** store image bytes in Postgres and do **not** proxy uploads or delivery through the Next.js server.
