/* Image sitemap (`/sitemap/images.xml`).
 *
 * §7.4 of the normative architecture specifies `/sitemaps/images-{n}.xml` and
 * `/sitemaps/videos-{n}.xml`. The page segments shipped; these did not. This
 * file closes the image half.
 *
 * Why it is worth more than llms.txt: Google documents and actively consumes
 * image sitemap extensions today. Property search is image-led — a listing
 * dossier's photographs are a real discovery surface through Google Images —
 * and images loaded through a JS gallery or a transform CDN are exactly the
 * case Google names as needing a sitemap to be found at all.
 *
 * Two rules this builder does NOT bend:
 *
 *   1. Same publishable gate as every other sitemap. An image belonging to a
 *      page the quality gate holds back is not advertised. Submitting media
 *      for a page Google is not supposed to index is a mixed signal.
 *   2. Absolute, canonical, fetchable URLs only. A relative `/images/x.webp`
 *      is silently dropped rather than guessed at, because a sitemap that
 *      advertises an unfetchable image is worse than one that omits it.
 *
 * Video is deliberately not implemented: the corpus has no video assets, and
 * a video sitemap requires a thumbnail, title, description and either a
 * content or player URL per entry. Emitting an empty `<video:video>` shell
 * would be advertising a capability that does not exist.
 *
 * Pure: no clock, no I/O, no request. */
import type { Property } from "@/lib/properties";
import { escapeXml, type SitemapUrlEntry } from "./sitemap";
import { isPublicIndexingEnabled, type RuntimeEnvironment } from "./runtime";
import { assetUrl, listingUrl } from "./urls";

export type SitemapImage = {
  loc: string;
  title?: string;
  caption?: string;
};

export type ImageSitemapEntry = Pick<SitemapUrlEntry, "loc"> & {
  images: SitemapImage[];
};

/** Resolve a listing's stored media reference to an absolute URL.
 *
 *  Fixture mode stores an asset KEY (`prop-courtyard`) that maps to
 *  `/images/{key}.jpg`; prisma/R2 mode carries an absolute URL on `imageUrl`.
 *  The absolute form always wins.
 *
 *  Note this resolves to the ORIGINAL asset, not a transform URL. Google wants
 *  the canonical image, and a width-parameterised CDN URL is one of N
 *  renditions of it — advertising a transform invites the same image to be
 *  indexed several times under different widths. */
export function resolveImageUrl(reference: string | undefined, base?: string): string | undefined {
  if (!reference) return undefined;
  if (/^https?:\/\//.test(reference)) return reference;
  /* A bare asset key, not a path: anything containing a slash is either
     already a path we would be guessing about or malformed input. */
  if (reference.includes("/")) return undefined;
  return assetUrl(`/images/${reference}.jpg`, base);
}

/** One `<url>` per listing, carrying its primary photo plus gallery.
 *
 *  `publishableListingIds` is the set of listings whose dossier page passed the
 *  quality gate — passed in rather than recomputed so this module cannot
 *  disagree with the page sitemap about what is publishable. */
export function toImageSitemapEntries(listings: Property[], publishableListingIds: ReadonlySet<string>, base?: string): ImageSitemapEntry[] {
  const entries: ImageSitemapEntry[] = [];
  for (const listing of listings) {
    if (!publishableListingIds.has(listing.id)) continue;

    /* Prefer the absolute URLs the data source carries; fall back to the
       fixture asset keys. Both are de-duplicated because a listing whose
       gallery repeats the hero photo must not advertise it twice. */
    const primary = resolveImageUrl(listing.imageUrl ?? listing.image, base);
    const gallery = (listing.galleryUrls ?? listing.gallery ?? [])
      .map((reference) => resolveImageUrl(reference, base))
      .filter((url): url is string => Boolean(url));

    const seen = new Set<string>();
    const images: SitemapImage[] = [];
    for (const loc of [primary, ...gallery]) {
      if (!loc || seen.has(loc)) continue;
      seen.add(loc);
      /* Title is the listing title; caption is the editorial note when there
         is one. Both are genuine per-listing text — no templated filler,
         because a caption that repeats across 5,000 listings is a spam
         signal rather than a relevance one. */
      images.push({ loc, title: listing.title, ...(listing.note ? { caption: listing.note } : {}) });
    }

    if (images.length) entries.push({ loc: listingUrl(listing.id, base), images });
  }
  return entries;
}

export function renderImageSitemapXml(entries: ImageSitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const images = entry.images
        .map((image) =>
          [
            "    <image:image>",
            `      <image:loc>${escapeXml(image.loc)}</image:loc>`,
            ...(image.title ? [`      <image:title>${escapeXml(image.title)}</image:title>`] : []),
            ...(image.caption ? [`      <image:caption>${escapeXml(image.caption)}</image:caption>`] : []),
            "    </image:image>",
          ].join("\n"),
        )
        .join("\n");
      return ["  <url>", `    <loc>${escapeXml(entry.loc)}</loc>`, images, "  </url>"].join("\n");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

/** Empty while indexing is gated off — same rule as every other sitemap. */
export function buildImageSitemap(
  listings: Property[],
  publishableListingIds: ReadonlySet<string>,
  env: RuntimeEnvironment = process.env,
  base?: string,
): string {
  if (!isPublicIndexingEnabled(env)) return renderImageSitemapXml([]);
  return renderImageSitemapXml(toImageSitemapEntries(listings, publishableListingIds, base));
}
