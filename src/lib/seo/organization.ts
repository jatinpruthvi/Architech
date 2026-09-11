/* Organization identity.

   Only publish facts that Architech can substantiate. The product serves India,
   but the repository does not establish a legal street address, phone, email,
   or claimed social profile. Country-wide coverage is `areaServed`; it is not a
   license to present the former Ahmedabad demo coordinates as a head office.
   Add address/contact/sameAs only through the production verification gate. */
import { assetUrl, homeUrl } from "./urls";

export const ORG_COUNTRY = "IN";

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${homeUrl()}#org`,
    name: "Architech",
    url: homeUrl(),
    logo: assetUrl("/icon-512.png"),
    description: "High-trust, locality-first property discovery across Indian cities.",
    areaServed: { "@type": "Country", name: "India" },
    /* No address/geo/telephone/email/sameAs until those identity facts are
       approved and published consistently on the contact surface. */
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      areaServed: { "@type": "Country", name: "India" },
      availableLanguage: ["en-IN", "hi-IN"],
    },
  };
}
