/* JSON-LD for guide articles.

   The three guide routes — city, locality and RERA — each carried their own
   copy of this block, which is why none of them had a breadcrumb: adding one
   meant editing three files that had already drifted (two used a relative
   image path, one an absolute URL). One builder, one place.

   Contestant D §2 asks for breadcrumbs on public routes marked up with
   schema. Guides are the only nested content type that had none: they sit two
   levels down under /guide/, and the trail is the silo D describes in §1 —
   city hub, then locality, then the article.

   `Article` is already the right type here. What D §3 asks for instead —
   `Product` — is not: `Product` describes something sold through a checkout,
   and Architech is a discovery platform with no transaction of its own. A
   property is modelled as `RealEstateListing` on the listing pages, which is
   the type Google documents for it. */
import type { Metadata } from "next";
import type { Guide } from "@/lib/repositories";
import { getGuides } from "@/lib/repositories";
import { assetUrl, cityUrl, guideUrl, homeUrl, localityUrl } from "./urls";
import { socialImage } from "./social";

export type BreadcrumbItem = { name: string; item: string };

/** Canonical URL of one guide article.

    `Guide.path` is the site-relative route (`/guide/city/ahmedabad/<slug>/`)
    while `guideUrl()` takes just the segment beneath `/guide/`. Every caller
    was re-deriving that split with the same regex, so it lives here. */
export function guideArticleUrl(guide: Guide): string {
  return guideUrl(guide.path.replace(/^\/guide\//, "").replace(/\/$/, ""));
}

/** The trail from the guide up to the home page.

    A locality guide sits under its city hub and locality page, so the trail
    follows the real hierarchy rather than a generic "Home › Guide › title".
    Anything we cannot resolve is left out rather than guessed. */
export function guideBreadcrumb(guide: Guide): BreadcrumbItem[] {
  const trail: BreadcrumbItem[] = [{ name: "Home", item: homeUrl() }];
  trail.push({ name: "Field notes", item: guideUrl() });
  if (guide.localitySlug) {
    trail.push({ name: `Buy in ${guide.citySlug}`, item: cityUrl(guide.citySlug) });
    trail.push({ name: guide.localitySlug, item: localityUrl(guide.citySlug, guide.localitySlug) });
  }
  trail.push({ name: guide.title, item: guideArticleUrl(guide) });
  return trail;
}

/** JSON-LD for one guide article. */
export function guideJsonLd(guide: Guide) {
  const canonical = guideArticleUrl(guide);
  const trail = guideBreadcrumb(guide);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        headline: guide.title,
        description: guide.summary,
        author: { "@type": "Organization", name: guide.author },
        dateModified: guide.updatedAt,
        datePublished: guide.updatedAt,
        mainEntityOfPage: canonical,
        image: assetUrl(`/images/${guide.image}.jpg`),
        isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: trail.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.item,
        })),
      },
    ],
  };
}

/** JSON-LD for the guide hub at /guide/.

    Contestant D §2 asks for breadcrumbs on public routes, and the hub is now
    a parent node: its articles point back at it. `/buy/` — the other
    top-level hub — already carries a two-crumb trail, so the hub matches it
    rather than sitting outside the silo it heads.

    Deliberately not added to the home page (it is the root, there is nothing
    above it) or to the legal and utility pages (`/privacy`, `/terms`,
    `/contact-us`, `/search`, the calculators): a Home › Privacy Policy trail
    reports a hierarchy the user cannot navigate and adds nothing. */
export function guideHubJsonLd() {
  const hub = guideUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${hub}#collection`,
        name: "Field notes — how we verify",
        url: hub,
        isPartOf: { "@type": "WebSite", name: "Architech", url: homeUrl() },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: getGuides().map((guide, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: guide.title,
            url: guideArticleUrl(guide),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: homeUrl() },
          { "@type": "ListItem", position: 2, name: "Field notes", item: hub },
        ],
      },
    ],
  };
}

/** Metadata for one guide article.

    The three route templates each carried their own copy of this too, which
    is how two of them came to emit a relative `og:url` and a relative image
    path. OGP requires absolute URLs for both; crawlers resolve relative ones
    against whatever host served the page, so the card is only accidentally
    right on production and breaks behind a proxy or preview host. */
export function guideMetadata(guide: Guide): Metadata {
  const canonical = guideArticleUrl(guide);
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical },
    robots:
      guide.status === "published" ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title: guide.title,
      description: guide.summary,
      url: canonical,
      images: [socialImage(guide.image)],
    },
  };
}
