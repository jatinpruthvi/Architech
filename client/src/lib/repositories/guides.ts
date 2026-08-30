export type GuideStatus = "prototype" | "editorial-review" | "published";
export type GuideRouteKind = "city" | "locality" | "rera";

export type GuideSource = {
  label: string;
  url?: string;
  note: string;
};

export type GuideSection = {
  heading: string;
  body: string;
};

export type Guide = {
  id: string;
  slug: string;
  routeKind: GuideRouteKind;
  citySlug: "ahmedabad";
  localitySlug?: string;
  path: string;
  title: string;
  summary: string;
  tag: string;
  time: string;
  image: string;
  status: GuideStatus;
  author: string;
  reviewer: string;
  updatedAt: string;
  sources: GuideSource[];
  sections: GuideSection[];
};

const guides: Guide[] = [
  {
    id: "verify-rera",
    slug: "how-we-verify-rera",
    routeKind: "rera",
    citySlug: "ahmedabad",
    path: "/guide/rera/gujarat/how-we-verify-rera/",
    title: "How we verify a listing against Gujarat RERA",
    summary: "A plain-language method for checking registration numbers, promoter details, source timestamps, and correction status before a listing earns a trust badge.",
    tag: "Methodology",
    time: "6 min read",
    image: "brick-arch",
    status: "editorial-review",
    author: "Architech Research Desk",
    reviewer: "Legal + Data review pending",
    updatedAt: "2026-08-24",
    sources: [
      { label: "Gujarat RERA public registry", url: "https://gujrera.gujarat.gov.in/", note: "Official source must be reviewed by legal before automated ingestion." },
      { label: "Architech RERA adapter contract", note: "Internal provenance, freshness, and correction workflow documented in repo." },
    ],
    sections: [
      { heading: "Start with the registration number", body: "Every RERA claim should start with a normalized registration number and a state-specific source. If the number format is invalid, the listing cannot receive a RERA-verified badge." },
      { heading: "Store provenance beside the claim", body: "Source URL, retrieval time, parser version, matched fields, confidence, and visible disclaimer belong with the record — not in a private spreadsheet." },
      { heading: "Show stale and disputed states", body: "Trust is strongest when uncertainty is visible. A record that is old, contested, or under correction should say so clearly on the page." },
    ],
  },
  {
    id: "paldi-trees",
    slug: "paldi-buying-guide",
    routeKind: "locality",
    citySlug: "ahmedabad",
    localitySlug: "paldi",
    path: "/guide/locality/ahmedabad/paldi-buying-guide/",
    title: "Paldi buying guide: read a neighbourhood",
    summary: "A field-note style guide to Paldi's central location, walkable pockets, older housing character, and source-first shortlisting method.",
    tag: "Locality study",
    time: "8 min read",
    image: "locality-street",
    status: "editorial-review",
    author: "Architech Locality Desk",
    reviewer: "Editorial review pending",
    updatedAt: "2026-08-24",
    sources: [
      { label: "OpenStreetMap contributors", note: "Coordinates and map context are derived from OSM data shown in the product." },
      { label: "Architech locality registry", note: "Locality notes and landmarks are maintained in the repository fixtures until live data is enabled." },
    ],
    sections: [
      { heading: "Why Paldi appears often in shortlists", body: "Paldi combines central access with older residential rhythm. The first question is not only price, but whether the street, daily routes, and building age match the buyer's routine." },
      { heading: "What to verify before visiting", body: "Check building age, parking, society rules, renovation history, RERA/project context where applicable, and whether the listed price has a recent freshness stamp." },
      { heading: "How Architech should improve this guide", body: "The production version should add verified school, commute, price-history, and project evidence before the page becomes indexable." },
    ],
  },
  {
    id: "ahmedabad-buying-guide",
    slug: "home-buying-guide",
    routeKind: "city",
    citySlug: "ahmedabad",
    path: "/guide/city/ahmedabad/home-buying-guide/",
    title: "Ahmedabad buying guide: place before address",
    summary: "A buyer-oriented guide for comparing Ahmedabad localities, verified listings, source trails, freshness stamps, and broker workflows.",
    tag: "Buying guide",
    time: "7 min read",
    image: "stepwell",
    status: "editorial-review",
    author: "Architech Editorial",
    reviewer: "Product + SEO review pending",
    updatedAt: "2026-08-24",
    sources: [
      { label: "Architech Phase 1 architecture", note: "Canonical page hierarchy, SEO rules, and trust requirements from the repository." },
      { label: "OpenStreetMap contributors", note: "Map and locality context source for current prototype surfaces." },
    ],
    sections: [
      { heading: "Compare localities first", body: "A good address is only useful if the locality fits the buyer's daily life. Start with commute, family needs, street character, and verified supply." },
      { heading: "Shortlist by evidence", body: "Every serious listing should show price, area, freshness, verification status, source trail, and media-rights confidence before a lead is sent." },
      { heading: "Use search and map together", body: "Filters narrow the market; the map checks whether the neighbourhood shape, access, and nearby context still make sense." },
    ],
  },
];

export function getGuides(): Guide[] {
  return guides;
}

export function getGuideByPath(path: string): Guide | undefined {
  const normalized = path.endsWith("/") ? path : `${path}/`;
  return guides.find((guide) => guide.path === normalized);
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}

export function getGuideStaticParams(routeKind: GuideRouteKind) {
  return guides.filter((guide) => guide.routeKind === routeKind).map((guide) => ({ slug: guide.slug }));
}
