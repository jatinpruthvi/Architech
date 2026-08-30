/* Organization identity (StudyArena round-12, contestant F §3 and §4).

   F's point is that property is YMYL: Google applies extra trust scrutiny to
   money queries, and the organisation behind the site is part of how it
   decides whether to trust it. He asks for a real address, a matched phone,
   RERA credentials, and `Organization` markup.

   Only some of that can be supplied honestly today. `/contact-us/` publishes
   "Ahmedabad, Gujarat · 23.03° N · 72.58° E" and states plainly that the
   phone and email channels are pending activation. So:

     · `address` and `geo` are marked up — they are already public facts.
     · `telephone`, `email` and `streetAddress` are **omitted**. Inventing a
       phone number to satisfy a schema recommendation would be worse than
       leaving it out: it is exactly the fabricated trust signal the YMYL
       scrutiny is designed to catch, and it would contradict the contact
       page a user can read.
     · `contactPoint` carries what is true — that support exists, in India, in
       English and Hindi — without claiming a channel that is not live.
     · `sameAs` is omitted for the same reason. It was deferred in file 8
       because the social profiles are not claimed; pointing `sameAs` at an
       unclaimed profile asserts an identity Architech has not established.

   The node is built here rather than inline in the layout so a test can hold
   it to that line: every field must be a fact the site already publishes. */
import { assetUrl, homeUrl } from "./urls";

/** The city Architech operates from, as published on `/contact-us/`. */
export const ORG_LOCALITY = "Ahmedabad";
export const ORG_REGION = "Gujarat";
export const ORG_COUNTRY = "IN";
export const ORG_LATITUDE = 23.03;
export const ORG_LONGITUDE = 72.58;

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${homeUrl()}#org`,
    name: "Architech",
    url: homeUrl(),
    logo: assetUrl("/icon-512.png"),
    description: "High-trust home discovery across India.",
    areaServed: { "@type": "Country", name: "India" },
    address: {
      "@type": "PostalAddress",
      addressLocality: ORG_LOCALITY,
      addressRegion: ORG_REGION,
      addressCountry: ORG_COUNTRY,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: ORG_LATITUDE,
      longitude: ORG_LONGITUDE,
    },
    /* No telephone and no email: both channels are behind an activation gate
       and the contact page says so. A contactPoint with the channels it does
       have, rather than a number invented to fill the field. */
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      areaServed: { "@type": "Country", name: "India" },
      availableLanguage: ["en-IN", "hi-IN"],
    },
  };
}
