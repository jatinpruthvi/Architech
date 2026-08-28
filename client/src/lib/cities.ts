/* City registry — the top of the India-wide place hierarchy.

   Architecture note (README "Information architecture"):
     Home → hubs → cities → localities → intent → entities

   A city is a first-class SEO entity: it owns a canonical `/buy/{city}/` hub,
   a set of localities, a price band used by demo inventory, and the metadata
   that city and locality pages render. Coordinates are OpenStreetMap-derived
   city centroids. Price bands and inventory counts are illustrative demo data
   until production sources are connected (see STATUS.md).

   To launch a new city: add an entry here, add its localities in
   `client/src/lib/localities.ts`, and every route, sitemap entry, SEO registry
   record, search alias, and city switcher picks it up automatically. */

export type CityTier = "metro" | "major" | "emerging";

export type City = {
  /** ASCII slug used in canonical URLs — never localized. */
  slug: string;
  name: string;
  /** Devanagari/native name shown alongside the English name. */
  hindi: string;
  state: string;
  stateSlug: string;
  tier: CityTier;
  /** One-line editorial positioning for the city hub hero. */
  tagline: string;
  /** Human-readable centroid, rendered as visible provenance text. */
  coords: string;
  /** "lat,lon" city centroid used by maps and JSON-LD. */
  marker: string;
  /** "west,south,east,north" viewport for the city-level map frame. */
  bbox: string;
  /** Illustrative median ₹ per sq ft, used to derive demo inventory pricing. */
  pricePerSqft: number;
  /** State RERA authority that governs listings in this city. */
  reraAuthority: string;
  /**
   * India Post PIN prefixes served by this city (a PIN's first three digits
   * identify its sorting district). Used to resolve an unknown PIN to a city
   * even when no locality in the registry claims it exactly.
   */
  pincodePrefixes: string[];
  /** Launch state — only `live` cities are indexable and routable. */
  status: "live" | "planned";
};

export const cities: City[] = [
  {
    slug: "ahmedabad",
    name: "Ahmedabad",
    hindi: "अमदावाद",
    state: "Gujarat",
    stateSlug: "gujarat",
    tier: "metro",
    tagline: "Riverfront calm, pol-city memory, and a western edge still being drawn",
    coords: "23.023° N · 72.571° E",
    marker: "23.0225,72.5714",
    bbox: "72.4400,22.9400,72.7000,23.1200",
    pricePerSqft: 7000,
    reraAuthority: "GujRERA",
    pincodePrefixes: ["380", "382"],
    status: "live",
  },
  {
    slug: "mumbai",
    name: "Mumbai",
    hindi: "मुंबई",
    state: "Maharashtra",
    stateSlug: "maharashtra",
    tier: "metro",
    tagline: "The country's densest market, where a balcony is a negotiation",
    coords: "19.076° N · 72.878° E",
    marker: "19.0760,72.8777",
    bbox: "72.7700,18.8900,73.0300,19.2800",
    pricePerSqft: 28000,
    reraAuthority: "MahaRERA",
    pincodePrefixes: ["400"],
    status: "live",
  },
  {
    slug: "delhi",
    name: "Delhi",
    hindi: "दिल्ली",
    state: "Delhi",
    stateSlug: "delhi",
    tier: "metro",
    tagline: "Colony by colony — each with its own rules about light and setback",
    coords: "28.614° N · 77.209° E",
    marker: "28.6139,77.2090",
    bbox: "76.9400,28.4100,77.3500,28.8800",
    pricePerSqft: 18000,
    reraAuthority: "Delhi RERA",
    pincodePrefixes: ["110"],
    status: "live",
  },
  {
    slug: "bengaluru",
    name: "Bengaluru",
    hindi: "बेंगलुरु",
    state: "Karnataka",
    stateSlug: "karnataka",
    tier: "metro",
    tagline: "Tech corridors, lake beds, and commutes measured in traffic lights",
    coords: "12.972° N · 77.595° E",
    marker: "12.9716,77.5946",
    bbox: "77.4600,12.8200,77.7800,13.1400",
    pricePerSqft: 11000,
    reraAuthority: "K-RERA",
    pincodePrefixes: ["560"],
    status: "live",
  },
  {
    slug: "hyderabad",
    name: "Hyderabad",
    hindi: "हैदराबाद",
    state: "Telangana",
    stateSlug: "telangana",
    tier: "metro",
    tagline: "Rock outcrops and wide new roads on the western employment belt",
    coords: "17.385° N · 78.487° E",
    marker: "17.3850,78.4867",
    bbox: "78.2600,17.2700,78.6000,17.5600",
    pricePerSqft: 8500,
    reraAuthority: "TG RERA",
    pincodePrefixes: ["500", "501"],
    status: "live",
  },
  {
    slug: "chennai",
    name: "Chennai",
    hindi: "चेन्नई",
    state: "Tamil Nadu",
    stateSlug: "tamil-nadu",
    tier: "metro",
    tagline: "Sea breeze, temple tanks, and an IT corridor running due south",
    coords: "13.083° N · 80.271° E",
    marker: "13.0827,80.2707",
    bbox: "80.1200,12.8800,80.3200,13.2000",
    pricePerSqft: 9500,
    reraAuthority: "TN RERA",
    pincodePrefixes: ["600"],
    status: "live",
  },
  {
    slug: "pune",
    name: "Pune",
    hindi: "पुणे",
    state: "Maharashtra",
    stateSlug: "maharashtra",
    tier: "metro",
    tagline: "Hill light on the western suburbs, old wadas holding the centre",
    coords: "18.520° N · 73.857° E",
    marker: "18.5204,73.8567",
    bbox: "73.7000,18.4300,73.9900,18.6500",
    pricePerSqft: 10000,
    reraAuthority: "MahaRERA",
    pincodePrefixes: ["411", "412"],
    status: "live",
  },
  {
    slug: "kolkata",
    name: "Kolkata",
    hindi: "कोलकाता",
    state: "West Bengal",
    stateSlug: "west-bengal",
    tier: "metro",
    tagline: "Verandahs and planned new towns, separated by a single bridge",
    coords: "22.573° N · 88.364° E",
    marker: "22.5726,88.3639",
    bbox: "88.2400,22.4600,88.4900,22.6600",
    pricePerSqft: 7500,
    reraAuthority: "WB HIRA / RERA",
    pincodePrefixes: ["700", "711"],
    status: "live",
  },
  {
    slug: "gurugram",
    name: "Gurugram",
    hindi: "गुरुग्राम",
    state: "Haryana",
    stateSlug: "haryana",
    tier: "major",
    tagline: "Glass towers on the Golf Course spine, sectors numbered outward",
    coords: "28.460° N · 77.027° E",
    marker: "28.4595,77.0266",
    bbox: "76.9200,28.3400,77.1600,28.5200",
    pricePerSqft: 12000,
    reraAuthority: "HARERA Gurugram",
    pincodePrefixes: ["122"],
    status: "live",
  },
  {
    slug: "noida",
    name: "Noida",
    hindi: "नोएडा",
    state: "Uttar Pradesh",
    stateSlug: "uttar-pradesh",
    tier: "major",
    tagline: "Grid planning, expressway frontage, and genuinely wide footpaths",
    coords: "28.536° N · 77.391° E",
    marker: "28.5355,77.3910",
    bbox: "77.3100,28.4000,77.5400,28.6600",
    pricePerSqft: 8000,
    reraAuthority: "UP RERA",
    pincodePrefixes: ["201"],
    status: "live",
  },
  {
    slug: "surat",
    name: "Surat",
    hindi: "सूरत",
    state: "Gujarat",
    stateSlug: "gujarat",
    tier: "major",
    tagline: "Diamond money building fast along the Tapi's southern bank",
    coords: "21.170° N · 72.831° E",
    marker: "21.1702,72.8311",
    bbox: "72.7100,21.0800,72.9100,21.2500",
    pricePerSqft: 6000,
    reraAuthority: "GujRERA",
    pincodePrefixes: ["394", "395"],
    status: "live",
  },
  {
    slug: "jaipur",
    name: "Jaipur",
    hindi: "जयपुर",
    state: "Rajasthan",
    stateSlug: "rajasthan",
    tier: "major",
    tagline: "Pink sandstone in the old city, ring roads and villas beyond it",
    coords: "26.912° N · 75.787° E",
    marker: "26.9124,75.7873",
    bbox: "75.6800,26.7900,75.8900,26.9800",
    pricePerSqft: 5500,
    reraAuthority: "RERA Rajasthan",
    pincodePrefixes: ["302"],
    status: "live",
  },
];

/** Cities approved for public routing, sitemaps, and the city switcher. */
export const liveCities = cities.filter((city) => city.status === "live");

/** The default city used when no city context is supplied (legacy entry points). */
export const DEFAULT_CITY_SLUG = "ahmedabad";

export function findCity(slug?: string): City | undefined {
  if (!slug) return undefined;
  return cities.find((city) => city.slug === slug.toLowerCase());
}

export function findLiveCity(slug?: string): City | undefined {
  const city = findCity(slug);
  return city?.status === "live" ? city : undefined;
}

export function cityName(slug?: string): string {
  return findCity(slug)?.name ?? "India";
}

/** Cities grouped by state — used by the all-India hub and footer directory. */
export function citiesByState(): { state: string; stateSlug: string; cities: City[] }[] {
  const groups = new Map<string, { state: string; stateSlug: string; cities: City[] }>();
  for (const city of liveCities) {
    const group = groups.get(city.stateSlug) ?? { state: city.state, stateSlug: city.stateSlug, cities: [] };
    group.cities.push(city);
    groups.set(city.stateSlug, group);
  }
  return [...groups.values()].sort((a, b) => a.state.localeCompare(b.state));
}
