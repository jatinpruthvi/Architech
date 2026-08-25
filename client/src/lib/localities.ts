/* Locality registry — names, Devanagari, OSM coordinates and map frames.
   Coordinates © OpenStreetMap contributors. Counts are illustrative demo data. */
export type Locality = {
  slug: string; name: string; hindi: string; note: string; homes: number;
  coords: string; marker: string; bbox: string;
  landmarks?: [string, string][];
};

export const localities: Locality[] = [
  {
    slug: "paldi", name: "Paldi", hindi: "पालडी", note: "Tree-lined, central, quietly established", homes: 42,
    coords: "23.011° N · 72.559° E", marker: "23.011,72.559", bbox: "72.5350,22.9950,72.5850,23.0270",
    landmarks: [["Law Garden", "≈ 1.4 km"], ["Sabarmati Riverfront", "≈ 1.8 km"], ["Tagore Hall", "≈ 0.9 km"], ["IIM Ahmedabad", "≈ 5.2 km"], ["SVP Airport", "≈ 11.6 km"]],
  },
  {
    slug: "navrangpura", name: "Navrangpura", hindi: "नवरंगपुरा", note: "Lively streets with a familiar pulse", homes: 31,
    coords: "23.039° N · 72.561° E", marker: "23.039,72.561", bbox: "72.5400,23.0250,72.5820,23.0530",
    landmarks: [["Gujarat College", "≈ 0.8 km"], ["Law Garden", "≈ 1.2 km"], ["Sabarmati Riverfront", "≈ 1.6 km"], ["SVP Airport", "≈ 9.4 km"]],
  },
  {
    slug: "prahlad-nagar", name: "Prahlad Nagar", hindi: "प्रह्लाद नगर", note: "Newer buildings, easy everyday rhythm", homes: 68,
    coords: "23.011° N · 72.507° E", marker: "23.011,72.507", bbox: "72.4880,22.9970,72.5260,23.0250",
  },
  {
    slug: "thaltej", name: "Thaltej", hindi: "थलतेज", note: "Room to breathe at the western edge", homes: 54,
    coords: "23.052° N · 72.509° E", marker: "23.052,72.509", bbox: "72.4900,23.0380,72.5280,23.0660",
  },
  {
    slug: "bopal", name: "Bopal", hindi: "बोपल", note: "Young families, wide roads, new schools", homes: 47,
    coords: "23.033° N · 72.464° E", marker: "23.033,72.464", bbox: "72.4450,23.0190,72.4830,23.0470",
  },
  {
    slug: "satellite", name: "Satellite", hindi: "सैटेलाइट", note: "Connected, confident, always awake", homes: 39,
    coords: "23.023° N · 72.519° E", marker: "23.023,72.519", bbox: "72.5000,23.0090,72.5380,23.0370",
  },
];

export const findLocality = (slug?: string) => localities.find((l) => l.slug === (slug ?? "paldi"));
