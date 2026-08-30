import "server-only";
import type { PrismaClient } from "@prisma/client";
import { isValidPincode, resolvePincode } from "@/lib/pincodes";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaDataSource } from "@/lib/repositories/source";

export type PostalResolution = {
  postalCode: string;
  precision: "postal-area";
  ambiguous: boolean;
  cities: Array<{ slug: string; name: string; state: string }>;
  localities: Array<{ id: string | null; slug: string; name: string; citySlug: string; cityName: string; linkType: string; confidence: number | null }>;
  postOffices: Array<{ id: string; name: string; officeType: string | null; deliveryStatus: string | null; districtName: string | null; stateName: string | null }>;
  administrativeAreas: Array<{
    id: string;
    lgdCode: string | null;
    name: string;
    slug: string | null;
    type: string;
    subtype: string | null;
    state: { lgdCode: string | null; name: string; slug: string | null } | null;
    confidence: number | null;
  }>;
  sources: Array<{ key: string; name: string; publisher: string; sourceUrl: string; licenseName: string | null; retrievedAt: string }>;
};

type SourceRow = {
  key: string;
  name: string;
  publisher: string;
  sourceUrl: string;
  licenseName: string | null;
  retrievedAt: Date | string;
  status?: string;
};

function sourceView(source: SourceRow) {
  return { ...source, retrievedAt: new Date(source.retrievedAt).toISOString() };
}

/** Exact six-digit resolution. No prefix fallback and no automatic conversion
 * of post-office labels into product neighbourhoods. */
export async function resolvePostalCodeForServer(value: string): Promise<PostalResolution | null> {
  const postalCode = value.trim();
  if (!isValidPincode(postalCode)) return null;

  if (!isPrismaDataSource()) {
    const match = resolvePincode(postalCode);
    if (!match) return null;
    return {
      postalCode,
      precision: "postal-area",
      ambiguous: match.ambiguous,
      cities: match.cities.map((city) => ({ slug: city.slug, name: city.name, state: city.state })),
      localities: match.localities.map((locality) => ({ id: null, slug: locality.slug, name: locality.name, citySlug: locality.citySlug, cityName: locality.cityName, linkType: "MANUAL", confidence: 0.5 })),
      postOffices: [],
      administrativeAreas: [],
      sources: [{ key: "architech-fixture-location-registry-v1", name: "Architech demo location registry", publisher: "Architech", sourceUrl: "https://github.com/jatinpruthvi/Architech/tree/main/prisma", licenseName: "Demo fixture", retrievedAt: "2026-08-26T00:00:00.000Z" }],
    };
  }

  const prisma = getPrismaClient() as unknown as PrismaClient;
  const row = await prisma.postalCode.findUnique({
    where: { code: postalCode, isActive: true },
    include: {
      source: true,
      localityLinks: { where: { validTo: null }, include: { locality: { include: { city: true } }, source: true }, orderBy: [{ isPrimary: "desc" }, { confidence: "desc" }] },
      postOffices: { where: { isActive: true, source: { status: "ACTIVE" } }, include: { source: true }, orderBy: { name: "asc" } },
      administrativeAreas: {
        where: { validTo: null, source: { status: "ACTIVE" } },
        include: { administrativeArea: { include: { parent: true } }, source: true },
        orderBy: { administrativeAreaId: "asc" },
      },
    },
  });
  if (!row || (!row.localityLinks.length && !row.postOffices.length && !row.administrativeAreas.length)) return null;

  const cities = new Map<string, { slug: string; name: string; state: string }>();
  for (const link of row.localityLinks) cities.set(link.locality.city.slug, link.locality.city);
  const sources = new Map<string, SourceRow>();
  if (row.source?.status === "ACTIVE") sources.set(row.source.key, row.source);
  for (const link of row.localityLinks) if (link.source?.status === "ACTIVE") sources.set(link.source.key, link.source);
  for (const office of row.postOffices) if (office.source) sources.set(office.source.key, office.source);
  for (const link of row.administrativeAreas) if (link.source) sources.set(link.source.key, link.source);

  return {
    postalCode,
    precision: "postal-area",
    ambiguous: row.localityLinks.length !== 1 || cities.size !== 1,
    cities: [...cities.values()],
    localities: row.localityLinks.map((link) => ({
      id: link.locality.id,
      slug: link.locality.slug,
      name: link.locality.name,
      citySlug: link.locality.city.slug,
      cityName: link.locality.city.name,
      linkType: link.linkType,
      confidence: link.confidence === null ? null : Number(link.confidence),
    })),
    postOffices: row.postOffices.map(({ source: _source, ...office }) => office),
    administrativeAreas: row.administrativeAreas.map((link) => ({
      id: link.administrativeArea.id,
      lgdCode: link.administrativeArea.code,
      name: link.administrativeArea.name,
      slug: link.administrativeArea.slug,
      type: link.administrativeArea.type,
      subtype: link.administrativeArea.subtype,
      state: link.administrativeArea.parent
        ? { lgdCode: link.administrativeArea.parent.code, name: link.administrativeArea.parent.name, slug: link.administrativeArea.parent.slug }
        : null,
      confidence: link.confidence === null ? null : Number(link.confidence),
    })),
    sources: [...sources.values()].map(sourceView),
  };
}
