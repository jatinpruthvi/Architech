import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const administrativeArea = vi.hoisted(() => ({ findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => ({ administrativeArea }) }));

import { getLocalBodiesForStateForServer } from "./directory";
import { GET } from "../../../../../app/api/locations/states/[state]/local-bodies/route";

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ARCHITECH_DATA_SOURCE", "fixture");
});

describe("LGD local-body directory", () => {
  it("exposes the official jurisdiction registry without inventing fixture local bodies", async () => {
    const result = await getLocalBodiesForStateForServer("gujarat");
    expect(result).toMatchObject({ mode: "reference-only", state: { lgdCode: "24", name: "Gujarat" }, localBodies: [], pagination: { total: 0 } });
    expect(administrativeArea.findMany).not.toHaveBeenCalled();
  });

  it("returns only sourced administrative bodies and their administrative PIN links", async () => {
    vi.stubEnv("ARCHITECH_DATA_SOURCE", "prisma");
    administrativeArea.findFirst.mockResolvedValue({ id: "state-24", code: "24", name: "Gujarat", slug: "gujarat", subtype: "State" });
    administrativeArea.count.mockResolvedValue(1);
    administrativeArea.findMany.mockResolvedValue([{
      id: "body-251141",
      code: "251141",
      name: "Ahmedabad",
      slug: "251141-ahmedabad",
      subtype: "Municipal Corporations",
      postalCodes: [{ postalCode: "380001" }, { postalCode: "380006" }],
    }]);
    const result = await getLocalBodiesForStateForServer("gujarat", 1, 500);
    expect(result).toMatchObject({
      mode: "prisma",
      localBodies: [{ lgdCode: "251141", name: "Ahmedabad", postalCodes: ["380001", "380006"] }],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    expect(administrativeArea.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ type: "LOCAL_BODY", parentId: "state-24", source: expect.objectContaining({ key: "lgd-local-bodies-with-pin-codes", status: "ACTIVE" }) }),
    }));
  });

  it("returns 404 for an unknown state slug", async () => {
    const response = await GET(new Request("https://example.com/api/locations/states/unknown/local-bodies"), { params: Promise.resolve({ state: "unknown" }) });
    expect(response.status).toBe(404);
  });
});
