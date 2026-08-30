/* Locality registry — names, Devanagari, OSM coordinates and map frames.
   Coordinates © OpenStreetMap contributors. Counts are illustrative demo data.

   Every locality belongs to a city in `client/src/lib/cities.ts`. Locality slugs
   are unique across India (asserted by `localities.test.ts`) so that a slug can
   be resolved with or without city context, while canonical URLs always carry
   the city segment: /buy/{city}/{locality}/. */
import type { AmenityRow } from "./realestate/amenities";
import { DEFAULT_CITY_SLUG, findCity } from "./cities";

export type Locality = {
  slug: string;
  name: string;
  hindi: string;
  note: string;
  homes: number;
  coords: string;
  marker: string;
  bbox: string;
  /** Owning city slug — always present after normalization. */
  citySlug: string;
  cityName: string;
  /** Nearby places with the distance as authored and the kind of place it
      is. The category is declared, not guessed: see `realestate/amenities`. */
  landmarks?: AmenityRow[];
  /** Locality price premium relative to the city median (1 = city median). */
  priceIndex: number;
  /**
   * India Post PIN codes served by this locality. A locality can span several
   * PINs and a PIN can span several localities, so this is a list on both
   * sides of the relationship — see `lib/pincodes.ts`.
   */
  pincodes: string[];
};

type LocalitySeed = Omit<Locality, "bbox" | "cityName" | "coords" | "pincodes" | "priceIndex"> & {
  bbox?: string;
  coords?: string;
  pincodes?: string[];
  priceIndex?: number;
};

/** Derive a readable "23.011° N · 72.559° E" label from a "lat,lon" marker. */
function coordLabel(marker: string): string {
  const [lat, lon] = marker.split(",").map((value) => Number(value));
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}° ${ns} · ${Math.abs(lon).toFixed(3)}° ${ew}`;
}

/** Derive a "west,south,east,north" map frame around a marker. */
function frame(marker: string, padLon = 0.019, padLat = 0.014): string {
  const [lat, lon] = marker.split(",").map((value) => Number(value));
  return [lon - padLon, lat - padLat, lon + padLon, lat + padLat].map((value) => value.toFixed(4)).join(",");
}

function normalize(seeds: LocalitySeed[]): Locality[] {
  return seeds.map((seed) => ({
    ...seed,
    coords: seed.coords ?? coordLabel(seed.marker),
    bbox: seed.bbox ?? frame(seed.marker),
    cityName: findCity(seed.citySlug)?.name ?? "India",
    priceIndex: seed.priceIndex ?? 1,
    pincodes: seed.pincodes ?? [],
  }));
}

const seeds: LocalitySeed[] = [
  /* ---------------- Ahmedabad, Gujarat ---------------- */
  {
    citySlug: "ahmedabad", slug: "paldi", name: "Paldi", hindi: "पालडी", note: "Tree-lined, central, quietly established", homes: 42,
    coords: "23.011° N · 72.559° E", marker: "23.011,72.559", bbox: "72.5350,22.9950,72.5850,23.0270", priceIndex: 1.12, pincodes: ["380007"],
    landmarks: [["Law Garden", "≈ 1.4 km", "green"], ["Sabarmati Riverfront", "≈ 1.8 km", "green"], ["Tagore Hall", "≈ 0.9 km", "culture"], ["IIM Ahmedabad", "≈ 5.2 km", "learning"], ["SVP Airport", "≈ 11.6 km", "transit"]],
  },
  {
    citySlug: "ahmedabad", slug: "navrangpura", name: "Navrangpura", hindi: "नवरंगपुरा", note: "Lively streets with a familiar pulse", homes: 31,
    coords: "23.039° N · 72.561° E", marker: "23.039,72.561", bbox: "72.5400,23.0250,72.5820,23.0530", priceIndex: 1.18, pincodes: ["380009"],
    landmarks: [["Gujarat College", "≈ 0.8 km", "learning"], ["Law Garden", "≈ 1.2 km", "green"], ["Sabarmati Riverfront", "≈ 1.6 km", "green"], ["SVP Airport", "≈ 9.4 km", "transit"]],
  },
  {
    citySlug: "ahmedabad", slug: "prahlad-nagar", name: "Prahlad Nagar", hindi: "प्रह्लाद नगर", note: "Newer buildings, easy everyday rhythm", homes: 68,
    coords: "23.011° N · 72.507° E", marker: "23.011,72.507", bbox: "72.4880,22.9970,72.5260,23.0250", priceIndex: 1.24, pincodes: ["380015"],
  },
  {
    citySlug: "ahmedabad", slug: "thaltej", name: "Thaltej", hindi: "थलतेज", note: "Room to breathe at the western edge", homes: 54,
    coords: "23.052° N · 72.509° E", marker: "23.052,72.509", bbox: "72.4900,23.0380,72.5280,23.0660", priceIndex: 1.2, pincodes: ["380059", "380054"],
  },
  {
    citySlug: "ahmedabad", slug: "bopal", name: "Bopal", hindi: "बोपल", note: "Young families, wide roads, new schools", homes: 47,
    coords: "23.033° N · 72.464° E", marker: "23.033,72.464", bbox: "72.4450,23.0190,72.4830,23.0470", priceIndex: 0.92, pincodes: ["380058"],
  },
  {
    citySlug: "ahmedabad", slug: "satellite", name: "Satellite", hindi: "सैटेलाइट", note: "Connected, confident, always awake", homes: 39,
    coords: "23.023° N · 72.519° E", marker: "23.023,72.519", bbox: "72.5000,23.0090,72.5380,23.0370", priceIndex: 1.15, pincodes: ["380015"],
  },

  /* ---------------- Mumbai, Maharashtra ---------------- */
  { citySlug: "mumbai", slug: "bandra-west", name: "Bandra West", hindi: "बांद्रा पश्चिम", note: "Sea-facing promenades and the city's most quoted address", homes: 58, marker: "19.0596,72.8295", priceIndex: 1.9, pincodes: ["400050"], landmarks: [["Bandra Bandstand", "≈ 1.1 km", "green"], ["Bandra–Worli Sea Link", "≈ 2.4 km", "transit"], ["Bandra Terminus", "≈ 3.0 km", "transit"]] },
  { citySlug: "mumbai", slug: "andheri-west", name: "Andheri West", hindi: "अंधेरी पश्चिम", note: "Studios, suburban rail, and endless small commerce", homes: 96, marker: "19.1364,72.8296", priceIndex: 1.05, pincodes: ["400058", "400053"], landmarks: [["Andheri Station", "≈ 1.6 km", "transit"], ["Versova Beach", "≈ 4.2 km", "green"], ["CSMI Airport T2", "≈ 5.1 km", "transit"]] },
  { citySlug: "mumbai", slug: "powai", name: "Powai", hindi: "पवई", note: "Lakeside campus town with planned streets", homes: 64, marker: "19.1176,72.9060", priceIndex: 1.22, pincodes: ["400076"], landmarks: [["Powai Lake", "≈ 0.7 km", "green"], ["IIT Bombay", "≈ 1.9 km", "learning"], ["Hiranandani Gardens", "≈ 0.5 km", "landmark"]] },
  { citySlug: "mumbai", slug: "chembur", name: "Chembur", hindi: "चेंबूर", note: "Central, green, and newly well connected", homes: 51, marker: "19.0522,72.9005", priceIndex: 0.86, pincodes: ["400071", "400074"] },
  { citySlug: "mumbai", slug: "goregaon-east", name: "Goregaon East", hindi: "गोरेगांव पूर्व", note: "Film-city side, big redevelopment pipeline", homes: 73, marker: "19.1663,72.8526", priceIndex: 0.82, pincodes: ["400063", "400065"] },
  { citySlug: "mumbai", slug: "thane-west", name: "Thane West", hindi: "ठाणे पश्चिम", note: "Lakes, malls, and the value end of the metro", homes: 112, marker: "19.2183,72.9781", priceIndex: 0.58, pincodes: ["400601", "400604", "400607"] },

  /* ---------------- Delhi ---------------- */
  { citySlug: "delhi", slug: "dwarka", name: "Dwarka", hindi: "द्वारका", note: "Sub-city of societies, wide sectors, metro spine", homes: 88, marker: "28.5921,77.0460", priceIndex: 0.72, pincodes: ["110075", "110078"], landmarks: [["Dwarka Sector 21 Metro", "≈ 2.2 km", "transit"], ["IGI Airport T3", "≈ 8.4 km", "transit"]] },
  { citySlug: "delhi", slug: "saket", name: "Saket", hindi: "साकेत", note: "South Delhi calm with malls at the doorstep", homes: 44, marker: "28.5245,77.2066", priceIndex: 1.3, pincodes: ["110017"], landmarks: [["Select Citywalk", "≈ 1.0 km", "retail"], ["Qutub Minar", "≈ 3.6 km", "culture"]] },
  { citySlug: "delhi", slug: "vasant-kunj", name: "Vasant Kunj", hindi: "वसंत कुंज", note: "Ridge forest edges and diplomatic quiet", homes: 37, marker: "28.5200,77.1591", priceIndex: 1.42, pincodes: ["110070"] },
  { citySlug: "delhi", slug: "rohini", name: "Rohini", hindi: "रोहिणी", note: "Planned North-West grid, strong resale depth", homes: 79, marker: "28.7495,77.0565", priceIndex: 0.66, pincodes: ["110085", "110089"] },
  { citySlug: "delhi", slug: "mayur-vihar", name: "Mayur Vihar", hindi: "मयूर विहार", note: "Yamuna-side societies, easy Noida access", homes: 56, marker: "28.6089,77.2952", priceIndex: 0.78, pincodes: ["110091", "110096"] },
  { citySlug: "delhi", slug: "punjabi-bagh", name: "Punjabi Bagh", hindi: "पंजाबी बाग", note: "Builder floors on West Delhi's widest roads", homes: 41, marker: "28.6663,77.1310", priceIndex: 1.08, pincodes: ["110026"] },

  /* ---------------- Bengaluru, Karnataka ---------------- */
  { citySlug: "bengaluru", slug: "indiranagar", name: "Indiranagar", hindi: "इंदिरानगर", note: "Old bungalow plots turned into the city's best walk", homes: 46, marker: "12.9784,77.6408", priceIndex: 1.45, pincodes: ["560038"], landmarks: [["100 Feet Road", "≈ 0.4 km", "transit"], ["Indiranagar Metro", "≈ 1.1 km", "transit"], ["Ulsoor Lake", "≈ 2.6 km", "green"]] },
  { citySlug: "bengaluru", slug: "koramangala", name: "Koramangala", hindi: "कोरमंगला", note: "Startup blocks, cafés, and short commutes", homes: 62, marker: "12.9352,77.6245", priceIndex: 1.38, pincodes: ["560034", "560095"] },
  { citySlug: "bengaluru", slug: "whitefield", name: "Whitefield", hindi: "व्हाइटफील्ड", note: "Tech parks, gated townships, and new metro", homes: 128, marker: "12.9698,77.7500", priceIndex: 0.82, pincodes: ["560066"], landmarks: [["ITPL", "≈ 2.0 km", "work"], ["Whitefield Metro", "≈ 1.4 km", "transit"]] },
  { citySlug: "bengaluru", slug: "hsr-layout", name: "HSR Layout", hindi: "एचएसआर लेआउट", note: "Sector grid, parks, and the flat-hunt favourite", homes: 84, marker: "12.9116,77.6474", priceIndex: 1.12, pincodes: ["560102"] },
  { citySlug: "bengaluru", slug: "hebbal", name: "Hebbal", hindi: "हेब्बाल", note: "Lake views and the cleanest run to the airport", homes: 59, marker: "13.0358,77.5970", priceIndex: 1.05, pincodes: ["560024"] },
  { citySlug: "bengaluru", slug: "electronic-city", name: "Electronic City", hindi: "इलेक्ट्रॉनिक सिटी", note: "Elevated expressway, employer-adjacent value", homes: 103, marker: "12.8452,77.6602", priceIndex: 0.62, pincodes: ["560100"] },

  /* ---------------- Hyderabad, Telangana ---------------- */
  { citySlug: "hyderabad", slug: "gachibowli", name: "Gachibowli", hindi: "गचीबौली", note: "Financial district frontage, still filling in", homes: 91, marker: "17.4401,78.3489", priceIndex: 1.24, pincodes: ["500032"], landmarks: [["Financial District", "≈ 3.1 km", "work"], ["Gachibowli Stadium", "≈ 1.2 km", "sports"]] },
  { citySlug: "hyderabad", slug: "hitec-city", name: "HITEC City", hindi: "हाईटेक सिटी", note: "Towers, skywalks, and the shortest tech commute", homes: 77, marker: "17.4435,78.3772", priceIndex: 1.3, pincodes: ["500081"] },
  { citySlug: "hyderabad", slug: "kondapur", name: "Kondapur", hindi: "कोंडापुर", note: "Mid-market depth right behind the tech belt", homes: 86, marker: "17.4615,78.3620", priceIndex: 1.02, pincodes: ["500084"] },
  { citySlug: "hyderabad", slug: "banjara-hills", name: "Banjara Hills", hindi: "बंजारा हिल्स", note: "Rock outcrops, road numbers, and old money", homes: 38, marker: "17.4126,78.4392", priceIndex: 1.62, pincodes: ["500034"] },
  { citySlug: "hyderabad", slug: "jubilee-hills", name: "Jubilee Hills", hindi: "जुबली हिल्स", note: "The city's most deliberate architecture", homes: 33, marker: "17.4239,78.4738", priceIndex: 1.74, pincodes: ["500033"] },
  { citySlug: "hyderabad", slug: "kukatpally", name: "Kukatpally", hindi: "कुकटपल्ली", note: "Dense, well-served, and priced for families", homes: 94, marker: "17.4849,78.4138", priceIndex: 0.78, pincodes: ["500072"] },

  /* ---------------- Chennai, Tamil Nadu ---------------- */
  { citySlug: "chennai", slug: "adyar", name: "Adyar", hindi: "अड्यार", note: "River, banyan shade, and settled institutions", homes: 43, marker: "13.0067,80.2570", priceIndex: 1.44, pincodes: ["600020"], landmarks: [["Adyar Estuary", "≈ 1.5 km", "green"], ["Elliot's Beach", "≈ 2.8 km", "green"]] },
  { citySlug: "chennai", slug: "anna-nagar", name: "Anna Nagar", hindi: "अन्ना नगर", note: "Planned blocks, tower park, deep resale market", homes: 61, marker: "13.0850,80.2101", priceIndex: 1.32, pincodes: ["600040"] },
  { citySlug: "chennai", slug: "velachery", name: "Velachery", hindi: "वेलाचेरी", note: "Central-south connector with everything nearby", homes: 72, marker: "12.9750,80.2210", priceIndex: 0.96, pincodes: ["600042"] },
  { citySlug: "chennai", slug: "thoraipakkam", name: "Thoraipakkam (OMR)", hindi: "तोरैपक्कम", note: "IT corridor frontage on Old Mahabalipuram Road", homes: 89, marker: "12.9401,80.2340", priceIndex: 0.88, pincodes: ["600097"] },
  { citySlug: "chennai", slug: "t-nagar", name: "T. Nagar", hindi: "टी नगर", note: "Retail heart — loud, central, always liquid", homes: 35, marker: "13.0418,80.2341", priceIndex: 1.36, pincodes: ["600017"] },
  { citySlug: "chennai", slug: "porur", name: "Porur", hindi: "पोरूर", note: "Western junction, hospitals, and fast new roads", homes: 66, marker: "13.0359,80.1565", priceIndex: 0.8, pincodes: ["600116"] },

  /* ---------------- Pune, Maharashtra ---------------- */
  { citySlug: "pune", slug: "kharadi", name: "Kharadi", hindi: "खराडी", note: "River-bend offices and premium new towers", homes: 87, marker: "18.5515,73.9470", priceIndex: 1.16, pincodes: ["411014"], landmarks: [["EON IT Park", "≈ 1.3 km", "work"], ["Pune Airport", "≈ 7.8 km", "transit"]] },
  { citySlug: "pune", slug: "baner", name: "Baner", hindi: "बाणेर", note: "Hill slopes, highway access, young households", homes: 78, marker: "18.5590,73.7868", priceIndex: 1.2, pincodes: ["411045"] },
  { citySlug: "pune", slug: "hinjawadi", name: "Hinjawadi", hindi: "हिंजवडी", note: "Rajiv Gandhi Infotech Park and its housing belt", homes: 118, marker: "18.5913,73.7389", priceIndex: 0.78, pincodes: ["411057"] },
  { citySlug: "pune", slug: "wakad", name: "Wakad", hindi: "वाकड", note: "Bridge to Hinjawadi with better everyday retail", homes: 92, marker: "18.5975,73.7625", priceIndex: 0.9, pincodes: ["411057"] },
  { citySlug: "pune", slug: "kothrud", name: "Kothrud", hindi: "कोथरूड", note: "Old Pune character with genuinely walkable lanes", homes: 54, marker: "18.5074,73.8077", priceIndex: 1.12, pincodes: ["411038"] },
  { citySlug: "pune", slug: "viman-nagar", name: "Viman Nagar", hindi: "विमान नगर", note: "Airport-side, cosmopolitan, well stocked", homes: 63, marker: "18.5679,73.9143", priceIndex: 1.08, pincodes: ["411014"] },

  /* ---------------- Kolkata, West Bengal ---------------- */
  { citySlug: "kolkata", slug: "salt-lake-sector-v", name: "Salt Lake Sector V", hindi: "साल्ट लेक सेक्टर V", note: "The IT block, with metro finally attached", homes: 57, marker: "22.5760,88.4330", priceIndex: 1.1, pincodes: ["700091"] },
  { citySlug: "kolkata", slug: "new-town-rajarhat", name: "New Town Rajarhat", hindi: "न्यू टाउन राजारहाट", note: "Widest roads in the state, still growing into them", homes: 104, marker: "22.5800,88.4600", priceIndex: 0.92, pincodes: ["700135", "700156"] },
  { citySlug: "kolkata", slug: "ballygunge", name: "Ballygunge", hindi: "बालीगंज", note: "South Kolkata's verandahs and old plane trees", homes: 39, marker: "22.5290,88.3650", priceIndex: 1.55, pincodes: ["700019"] },
  { citySlug: "kolkata", slug: "tollygunge", name: "Tollygunge", hindi: "टॉलीगंज", note: "Club greens, studios, and metro at the door", homes: 48, marker: "22.4980,88.3430", priceIndex: 1.06, pincodes: ["700033"] },
  { citySlug: "kolkata", slug: "behala", name: "Behala", hindi: "बेहाला", note: "Deep south-west value with new metro reach", homes: 67, marker: "22.4990,88.3160", priceIndex: 0.7, pincodes: ["700034"] },
  { citySlug: "kolkata", slug: "howrah", name: "Howrah", hindi: "हावड़ा", note: "Across the bridge — the cheapest way into the metro", homes: 71, marker: "22.5958,88.2636", priceIndex: 0.62, pincodes: ["711101"] },

  /* ---------------- Gurugram, Haryana ---------------- */
  { citySlug: "gurugram", slug: "golf-course-road", name: "Golf Course Road", hindi: "गोल्फ कोर्स रोड", note: "The premium spine — towers, clubs, rapid metro", homes: 69, marker: "28.4211,77.0961", priceIndex: 1.6, pincodes: ["122002"] },
  { citySlug: "gurugram", slug: "dlf-phase-5", name: "DLF Phase 5", hindi: "डीएलएफ फेज 5", note: "Established condominiums with mature landscaping", homes: 52, marker: "28.4390,77.1030", priceIndex: 1.52, pincodes: ["122009"] },
  { citySlug: "gurugram", slug: "sohna-road", name: "Sohna Road", hindi: "सोहना रोड", note: "Mid-market corridor with the shortest office hops", homes: 83, marker: "28.4089,77.0378", priceIndex: 0.94, pincodes: ["122018"] },
  { citySlug: "gurugram", slug: "sushant-lok", name: "Sushant Lok", hindi: "सुशांत लोक", note: "Builder floors and greenery, centrally placed", homes: 58, marker: "28.4674,77.0708", priceIndex: 1.14, pincodes: ["122009"] },
  { citySlug: "gurugram", slug: "new-gurugram", name: "New Gurugram", hindi: "न्यू गुरुग्राम", note: "Dwarka Expressway sectors, still under construction", homes: 97, marker: "28.3760,76.9500", priceIndex: 0.76, pincodes: ["122004"] },
  { citySlug: "gurugram", slug: "mg-road-gurugram", name: "MG Road", hindi: "एमजी रोड", note: "Delhi-border malls and the original metro stretch", homes: 44, marker: "28.4795,77.0805", priceIndex: 1.22, pincodes: ["122002"] },

  /* ---------------- Noida, Uttar Pradesh ---------------- */
  { citySlug: "noida", slug: "noida-sector-150", name: "Sector 150", hindi: "सेक्टर 150", note: "Eighty percent green — the planned showpiece", homes: 74, marker: "28.4265,77.4880", priceIndex: 1.24, pincodes: ["201310"] },
  { citySlug: "noida", slug: "noida-sector-62", name: "Sector 62", hindi: "सेक्टर 62", note: "Office cluster with metro and older societies", homes: 53, marker: "28.6270,77.3720", priceIndex: 1.05, pincodes: ["201309"] },
  { citySlug: "noida", slug: "noida-sector-137", name: "Sector 137", hindi: "सेक्टर 137", note: "Expressway frontage, high-rise rentals", homes: 81, marker: "28.5090,77.4030", priceIndex: 0.9, pincodes: ["201305"] },
  { citySlug: "noida", slug: "noida-sector-78", name: "Sector 78", hindi: "सेक्टर 78", note: "Large townships, schools, and metro at 76", homes: 88, marker: "28.5680,77.3830", priceIndex: 0.96, pincodes: ["201305"] },
  { citySlug: "noida", slug: "noida-extension", name: "Noida Extension", hindi: "नोएडा एक्सटेंशन", note: "Greater Noida West — the affordability engine", homes: 132, marker: "28.6100,77.4300", priceIndex: 0.58, pincodes: ["201306"] },
  { citySlug: "noida", slug: "greater-noida-alpha", name: "Greater Noida Alpha", hindi: "ग्रेटर नोएडा अल्फा", note: "Institutional belt, plotted housing, quiet roads", homes: 47, marker: "28.4770,77.5100", priceIndex: 0.52, pincodes: ["201310"] },

  /* ---------------- Surat, Gujarat ---------------- */
  { citySlug: "surat", slug: "vesu", name: "Vesu", hindi: "वेसू", note: "The city's premium address, planned and green", homes: 76, marker: "21.1418,72.7710", priceIndex: 1.3, pincodes: ["395007"] },
  { citySlug: "surat", slug: "adajan", name: "Adajan", hindi: "अडाजण", note: "Riverside, family-dense, everything within reach", homes: 84, marker: "21.1959,72.7933", priceIndex: 1.02, pincodes: ["395009"] },
  { citySlug: "surat", slug: "pal", name: "Pal", hindi: "पाल", note: "New towers west of the Tapi, fast approvals", homes: 62, marker: "21.1780,72.7620", priceIndex: 0.96, pincodes: ["395009"] },
  { citySlug: "surat", slug: "piplod", name: "Piplod", hindi: "पिपलोद", note: "Between the airport road and the good schools", homes: 49, marker: "21.1540,72.7760", priceIndex: 1.12, pincodes: ["395007"] },
  { citySlug: "surat", slug: "althan", name: "Althan", hindi: "अल्थाण", note: "Southern growth ring, value per square foot", homes: 58, marker: "21.1550,72.7960", priceIndex: 0.88, pincodes: ["395017"] },
  { citySlug: "surat", slug: "dumas-road", name: "Dumas Road", hindi: "डुमस रोड", note: "Coast-bound corridor with resort-style projects", homes: 41, marker: "21.1200,72.7300", priceIndex: 1.18, pincodes: ["394518"] },

  /* ---------------- Jaipur, Rajasthan ---------------- */
  { citySlug: "jaipur", slug: "vaishali-nagar", name: "Vaishali Nagar", hindi: "वैशाली नगर", note: "North-west hub with the busiest retail street", homes: 68, marker: "26.9124,75.7400", priceIndex: 1.08, pincodes: ["302021"] },
  { citySlug: "jaipur", slug: "mansarovar", name: "Mansarovar", hindi: "मानसरोवर", note: "Asia's largest planned colony, still orderly", homes: 92, marker: "26.8500,75.7600", priceIndex: 0.9, pincodes: ["302020"] },
  { citySlug: "jaipur", slug: "malviya-nagar", name: "Malviya Nagar", hindi: "मालवीय नगर", note: "Institutional, central-south, consistently liquid", homes: 57, marker: "26.8540,75.8060", priceIndex: 1.14, pincodes: ["302017"] },
  { citySlug: "jaipur", slug: "jagatpura", name: "Jagatpura", hindi: "जगतपुरा", note: "Ring-road side plots and new apartment stock", homes: 73, marker: "26.8210,75.8560", priceIndex: 0.84, pincodes: ["302017"] },
  { citySlug: "jaipur", slug: "c-scheme", name: "C-Scheme", hindi: "सी-स्कीम", note: "Colonial-era plots, the city's most guarded address", homes: 29, marker: "26.9080,75.7940", priceIndex: 1.66, pincodes: ["302001"] },
  { citySlug: "jaipur", slug: "ajmer-road", name: "Ajmer Road", hindi: "अजमेर रोड", note: "Westward highway corridor, fastest new supply", homes: 64, marker: "26.8900,75.7300", priceIndex: 0.76, pincodes: ["302019"] },
];

export const localities: Locality[] = normalize(seeds);

/** All localities in a city, in registry order. */
export function localitiesForCity(citySlug: string): Locality[] {
  return localities.filter((locality) => locality.citySlug === citySlug);
}

/**
 * Resolve a locality by slug. When `citySlug` is supplied the match is scoped to
 * that city, which is what routes should always do; without it the first
 * matching slug wins (slugs are unique across the registry).
 */
export const findLocality = (slug?: string, citySlug?: string) => {
  if (!slug) {
    const scope = citySlug ? localitiesForCity(citySlug) : localities;
    return scope.find((locality) => locality.citySlug === (citySlug ?? DEFAULT_CITY_SLUG)) ?? scope[0];
  }
  return localities.find((locality) => locality.slug === slug && (!citySlug || locality.citySlug === citySlug));
};
