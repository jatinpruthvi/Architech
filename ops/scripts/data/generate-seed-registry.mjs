/* Regenerates `prisma/seed-registry.mjs` from the TypeScript place registry.

   The seed script is plain ESM and cannot import the TypeScript registry, so
   this script projects the registry into a generated data module. Run it after
   adding or changing a city or locality:

     node scripts/data/generate-seed-registry.mjs

   `client/src/lib/seed-sync.test.ts` fails the build if the generated file
   drifts from the registry, so this can never be silently forgotten. */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Vitest ships a TypeScript-capable loader; reuse it so this script has no extra deps.
const { createServer } = require(path.join(root, "node_modules/vite/dist/node/index.js"));

const server = await createServer({
  root,
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "silent",
  // The registry modules have no runtime deps to pre-bundle; scanning the whole
  // app here only produces noise.
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { "@": path.join(root, "client/src") } },
});

try {
  const { cities } = await server.ssrLoadModule("/client/src/lib/cities.ts");
  const { localities } = await server.ssrLoadModule("/client/src/lib/localities.ts");

  const coord = (marker, index) => Number(marker.split(",")[index]).toFixed(6);

  const CITIES = cities.map((city) => ({
    slug: city.slug,
    name: city.name,
    hindiName: city.hindi,
    state: city.state,
    country: "IN",
    latitude: coord(city.marker, 0),
    longitude: coord(city.marker, 1),
    pincodePrefixes: city.pincodePrefixes,
  }));

  const LOCALITIES = localities.map((locality) => ({
    citySlug: locality.citySlug,
    slug: locality.slug,
    name: locality.name,
    hindiName: locality.hindi,
    note: locality.note,
    demoHomeCount: locality.homes,
    latitude: coord(locality.marker, 0),
    longitude: coord(locality.marker, 1),
    bbox: locality.bbox,
    pincodes: locality.pincodes,
    ...(locality.landmarks ? { landmarks: locality.landmarks } : {}),
  }));

  const body = `/* GENERATED — do not edit by hand.
   Mirrors the place registry in \`client/src/lib/cities.ts\` and
   \`client/src/lib/localities.ts\` so \`prisma db seed\` provisions exactly the
   cities and localities the application routes, sitemaps, and SEO registry
   expect. \`client/src/lib/seed-sync.test.ts\` fails if the two drift apart.

   Regenerate with: node scripts/data/generate-seed-registry.mjs */

export const CITIES = ${JSON.stringify(CITIES, null, 2)};

export const LOCALITIES = ${JSON.stringify(LOCALITIES, null, 2)};
`;

  writeFileSync(path.join(root, "prisma/seed-registry.mjs"), body);
  console.log(`Wrote prisma/seed-registry.mjs — ${CITIES.length} cities, ${LOCALITIES.length} localities.`);
} finally {
  await server.close();
}
