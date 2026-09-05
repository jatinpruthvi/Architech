-- Media object key: `PropertyMedia.objectKey TEXT?`.
--
-- The R2 decision (docs/media/media-storage-decision.md) stores listing media
-- bytes in Cloudflare R2 and only the metadata row in Postgres. Retention
-- (phase 4) requires deleting the OBJECT when a record is expired, rejected
-- or taken down — marking the row DELETED is not enough, because the bytes
-- would otherwise stay in object storage indefinitely.
--
-- `objectKey` records the exact storage key the sign endpoint handed to the
-- browser (e.g. `listing-drafts/<draftId>/<uploadId>/<file>`), so the
-- retention sweep and the takedown path can target the right object. NULL
-- for pre-decision uploads and for memory-storage mode, where no object
-- exists to delete.

ALTER TABLE "PropertyMedia" ADD COLUMN "objectKey" TEXT;
