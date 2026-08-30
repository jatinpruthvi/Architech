import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postalCode = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => ({ postalCode }) }));

import { GET } from "../../../../../app/api/locations/postal-codes/[code]/route";
import { resolvePostalCodeForServer } from "./postal-resolution";

const context = (code: string) => ({ params: Promise.resolve({ code }) });

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ARCHITECH_DATA_SOURCE", "fixture");
});

describe("exact postal-code resolution", () => {
  it("returns every reviewed locality for a shared exact PIN", async () => {
    const response = await GET(new Request("http://example.com/api/locations/postal-codes/395007"), context("395007"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.resolution).toMatchObject({ postalCode: "395007", precision: "postal-area", ambiguous: true });
    expect(body.resolution.localities.map((locality: { slug: string }) => locality.slug).sort()).toEqual(["piplod", "vesu"]);
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate");
  });

  it("never converts a sorting-prefix match into an exact match", async () => {
    // Other 400xxx fixture PINs exist, but 400104 has no reviewed exact link.
    const response = await GET(new Request("http://example.com/api/locations/postal-codes/400104"), context("400104"));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ ok: false, postalCode: "400104" });
  });

  it("rejects malformed PINs before resolution", async () => {
    const response = await GET(new Request("http://example.com/api/locations/postal-codes/040010"), context("040010"));
    expect(response.status).toBe(400);
    expect(postalCode.findUnique).not.toHaveBeenCalled();
  });

  it("keeps post-office labels separate from product localities in Prisma mode", async () => {
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
    const source = {
      key: "india-post-2026",
      name: "India Post PIN directory",
      publisher: "Department of Posts",
      sourceUrl: "https://www.indiapost.gov.in/rti/pincodelist",
      licenseName: "GODL-India",
      retrievedAt: new Date("2026-08-30T00:00:00.000Z"),
    };
    postalCode.findUnique.mockResolvedValue({
      code: "400104",
      source,
      localityLinks: [],
      postOffices: [{
        id: "po-1",
        name: "Goregaon S.O",
        officeType: "S.O",
        deliveryStatus: "Delivery",
        districtName: "Mumbai Suburban",
        stateName: "Maharashtra",
        source,
      }],
      administrativeAreas: [{
        confidence: 1,
        source,
        administrativeArea: {
          id: "local-body-1",
          code: "251528",
          name: "Mumbai Municipal Corporation",
          slug: "mumbai-municipal-corporation-251528",
          type: "LOCAL_BODY",
          subtype: "Municipal Corporation",
          parent: { code: "27", name: "Maharashtra", slug: "maharashtra" },
        },
      }],
    });

    const result = await resolvePostalCodeForServer("400104");
    expect(postalCode.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: "400104", isActive: true } }));
    expect(result).toMatchObject({ postalCode: "400104", ambiguous: true, cities: [], localities: [] });
    expect(result?.postOffices).toEqual([expect.objectContaining({ name: "Goregaon S.O" })]);
    expect(result?.administrativeAreas).toEqual([
      expect.objectContaining({ lgdCode: "251528", name: "Mumbai Municipal Corporation", state: expect.objectContaining({ lgdCode: "27" }) }),
    ]);
    expect(result?.localities).toEqual([]);
    expect(result?.sources).toHaveLength(1);
  });
});
