/* Stable entity identifiers for the knowledge graph.
 *
 * The problem this solves. Architech already emits rich JSON-LD, but almost
 * every place node is ANONYMOUS. `/buy/ahmedabad/` describes a City called
 * "Ahmedabad". `/buy/ahmedabad/bopal/` describes a different City node also
 * called "Ahmedabad". `/price-index/ahmedabad/` describes a third. A listing
 * dossier describes a PostalAddress with `addressLocality: "Bopal"` that is
 * connected to none of them.
 *
 * To a search engine those are up to ~500 unrelated blobs that happen to share
 * a name. Nothing accrues. Give every place ONE `@id` and the same markup
 * becomes a graph: 12 city entities, 72 locality entities, and every listing,
 * price report, guide, and hub pointing at them. That is the difference
 * between "pages that mention Bopal" and "the site that knows what Bopal is" —
 * and it is what earns entity-level treatment in AI answers and knowledge
 * panels, where competitors with far more inventory are still shipping
 * disconnected per-page markup.
 *
 * Why fragment URIs on canonical URLs. An `@id` must be a globally unique,
 * stable IRI. Deriving it from the canonical URL of the page that DEFINES the
 * entity means the id is unique by construction, survives redeploys, and is
 * dereferenceable — the definition really is served at that address. The
 * fragment (`#city`) distinguishes the entity from the document about it,
 * which is the distinction `mainEntity`/`about` depend on.
 *
 * The rule callers must follow: exactly ONE page defines each entity in full;
 * everywhere else emits a reference — `{ "@id": ... }` with no other
 * properties, or at most a `name` for readability. Re-describing an entity
 * with partial or conflicting properties on every page is how a graph gets
 * poisoned rather than built.
 *
 * Pure: no clock, no I/O, no request. */

import { canonicalUrl, cityUrl, homeUrl, listingUrl, localityUrl } from "./urls";

/** A reference to an entity defined elsewhere. Deliberately minimal: a node
 *  that is not the definition must not restate the entity's properties. */
export type EntityRef = { "@id": string };

/** The publisher. Defined once, in the root layout. */
export function orgId(): string {
  return `${homeUrl()}#org`;
}

/** The website itself. Defined once, in the root layout. */
export function websiteId(): string {
  return `${homeUrl()}#website`;
}

/* Cities and localities are defined on their BUY pages, not their rent pages.
   A place is one real-world entity; "Bopal" does not become a second place
   because the visitor wants to rent. The buy page is the definition site
   because it predates the rent split and is the surface that always exists.
   Rent pages reference the same id, which is precisely what tells a search
   engine the two URLs are about one place with two intents. */

/** Stable id for a city entity. */
export function cityId(citySlug: string): string {
  return `${cityUrl(citySlug, "buy")}#city`;
}

/** Stable id for a locality entity. */
export function localityId(citySlug: string, localitySlug: string): string {
  return `${localityUrl(citySlug, localitySlug, "buy")}#locality`;
}

/** Stable id for a state / administrative area.
 *
 *  Anchored on the locations hub rather than a per-state page: `/locations/
 *  {state}/` is currently `noindex` (LGD data has no publication gate yet), and
 *  an `@id` should not point at a URL search engines are told to ignore. */
export function stateId(stateSlug: string): string {
  return `${canonicalUrl("/locations/")}#state-${stateSlug}`;
}

/** Stable id for the real-world property described by a listing. */
export function residenceId(listingId: string): string {
  return `${listingUrl(listingId)}#residence`;
}

/** Stable id for the offer/listing document about that property. */
export function listingOfferId(listingId: string): string {
  return `${listingUrl(listingId)}#listing`;
}

/** A bare reference. Use everywhere except the one defining page. */
export function ref(id: string): EntityRef {
  return { "@id": id };
}

/** A reference carrying a human-readable name.
 *
 *  Still a reference, not a definition: `name` is the one property safe to
 *  repeat because it is what the entity is called, not a claim about it. */
export function namedRef(id: string, name: string): EntityRef & { name: string } {
  return { "@id": id, name };
}

/** The canonical City node, with its containing state.
 *
 *  `full: false` (the default) returns a reference for use on the ~500 pages
 *  that merely mention the city. `full: true` returns the definition and
 *  belongs only on the city's own buy page. */
export function cityNode(
  city: { slug: string; name: string; state: string; stateSlug: string },
  options: { full?: boolean } = {},
) {
  const id = cityId(city.slug);
  if (!options.full) return { "@id": id, "@type": "City" as const, name: city.name };
  return {
    "@type": "City" as const,
    "@id": id,
    name: city.name,
    url: cityUrl(city.slug, "buy"),
    containedInPlace: {
      "@type": "AdministrativeArea" as const,
      "@id": stateId(city.stateSlug),
      name: city.state,
      containedInPlace: { "@type": "Country" as const, name: "India" },
    },
  };
}

/** The canonical locality reference, always contained in its city.
 *
 *  Only ever a reference here: the full definition lives on the locality page,
 *  which owns the geo, address, PIN codes, and trust properties. */
export function localityRef(citySlug: string, localitySlug: string, name: string) {
  return { "@type": "Place" as const, "@id": localityId(citySlug, localitySlug), name };
}
