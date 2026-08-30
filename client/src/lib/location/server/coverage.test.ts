import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  administrativeArea: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  postalCode: { count: vi.fn() },
  postOffice: { count: vi.fn(), groupBy: vi.fn() },
  administrativeAreaPostalCode: { count: vi.fn() },
  locationSource: { findFirst: vi.fn() },
}));

vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => database }));
import { GET as getCoverage } from "../../../../../app/api/locations/status/route";
import { GET as getStates } from "../../../../../app/api/locations/states/route";
import { getIndiaLocationCoverageForServer } from "./coverage";

const now = new Date("2026-08-30T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
  const states = Array.from({ length: 36 }, (_, index) => ({
    id: `state-${index + 1}`,
    code: String(index + 1),
    name: `State ${index + 1}`,
    nativeName: null,
    slug: `state-${index + 1}`,
    subtype: index < 28 ? "State" : "Union Territory",
  }));
  database.administrativeArea.findMany.mockResolvedValue(states);
  database.postalCode.count.mockResolvedValue(19_000);
  database.postOffice.count.mockResolvedValue(165_000);
  database.postOffice.groupBy.mockResolvedValue(states.slice(0, 35).map((state) => ({ administrativeAreaId: state.id, _count: { _all: 4_000 } })));
  database.administrativeArea.count.mockResolvedValue(5_000);
  database.administrativeArea.groupBy.mockResolvedValue(states.map((state) => ({ parentId: state.id, _count: { _all: 100 } })));
  database.administrativeAreaPostalCode.count.mockResolvedValue(7_000);
  database.locationSource.findFirst.mockImplementation(async ({ where }: { where: { key: string } }) => ({
    key: where.key,
    name: where.key,
    publisher: "Government of India",
    sourceUrl: "https://example.gov.in/source",
    licenseName: "Government Open Data License - India",
    licenseUrl: "https://ap.data.gov.in/godl",
    attribution: "Government data attribution",
    version: "2026-08-30",
    checksumSha256: "a".repeat(64),
    retrievedAt: new Date("2026-08-30T00:00:00.000Z"),
  }));
});

afterEach(() => vi.unstubAllEnvs());

describe("India location production coverage", () => {
  it("is ready only when national counts and freshness gates pass", async () => {
    const result = await getIndiaLocationCoverageForServer(now);
    expect(result.status).toBe("ready");
    expect(result.gates).toEqual({ stateRegistryComplete: true, postalDirectoryComplete: true, localBodyDirectoryComplete: true, sourcesFresh: true });
    expect(result.totals.statesWithPostOffices).toBe(35);
    expect(result.states[0].localBodyCount).toBe(100);
  });

  it("fails readiness rather than presenting a partial import as national coverage", async () => {
    database.postOffice.count.mockResolvedValue(1_000);
    database.administrativeAreaPostalCode.count.mockResolvedValue(100);
    const result = await getIndiaLocationCoverageForServer(now);
    expect(result.status).toBe("incomplete");
    expect(result.gates.postalDirectoryComplete).toBe(false);
    expect(result.gates.localBodyDirectoryComplete).toBe(false);
  });

  it("exposes reference-only coverage and all 36 jurisdictions through public APIs without a database", async () => {
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "fixture");
    const [coverageResponse, statesResponse] = await Promise.all([getCoverage(), getStates()]);
    expect(coverageResponse.status).toBe(200);
    expect(await coverageResponse.json()).toMatchObject({ ok: true, coverage: { mode: "reference-only", status: "incomplete", totals: { stateOrUtCount: 36 } } });
    const states = await statesResponse.json();
    expect(states.ok).toBe(true);
    expect(states.states).toHaveLength(36);
    expect(states.disclaimer).toMatch(/bulk snapshots/i);
  });

  it("fails readiness for stale official sources", async () => {
    database.locationSource.findFirst.mockImplementation(async ({ where }: { where: { key: string } }) => ({
      key: where.key,
      name: where.key,
      publisher: "Government of India",
      sourceUrl: "https://example.gov.in/source",
      licenseName: "Government Open Data License - India",
      licenseUrl: "https://ap.data.gov.in/godl",
      attribution: "Government data attribution",
      version: "2025-01-01",
      checksumSha256: "a".repeat(64),
      retrievedAt: new Date("2025-01-01T00:00:00.000Z"),
    }));
    const result = await getIndiaLocationCoverageForServer(now);
    expect(result.status).toBe("incomplete");
    expect(result.gates.sourcesFresh).toBe(false);
  });
});
