import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const state = { prismaMode: false };
vi.mock("@/lib/repositories/source", () => ({
  isPrismaDataSource: () => state.prismaMode,
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

const mocks = vi.hoisted(() => ({
  getCitiesForServer: vi.fn(),
  getLocalitiesForServer: vi.fn(),
  getListingsForServer: vi.fn(),
  getAgentDirectoryForServer: vi.fn(),
}));
vi.mock("@/lib/repositories/server/prisma", () => ({
  getCitiesForServer: mocks.getCitiesForServer,
  getLocalitiesForServer: mocks.getLocalitiesForServer,
  getListingsForServer: mocks.getListingsForServer,
  getAgentDirectoryForServer: mocks.getAgentDirectoryForServer,
  MAX_UNSCOPED_LISTING_ROWS: 5000,
}));

import { seoPages } from "./pages";
import { getPublishableSeoPagesForServer, getServerSeoRegistry, resetServerSeoRegistryCache } from "./pages-server";

describe("getServerSeoRegistry", () => {
  beforeEach(() => {
    state.prismaMode = false;
    resetServerSeoRegistryCache();
    vi.clearAllMocks();
  });

  it("fixture mode returns the module registry untouched — no drift, no waiting", async () => {
    const registry = await getServerSeoRegistry();
    expect(registry.source).toBe("fixture");
    expect(registry.pages).toEqual(seoPages);
    expect(mocks.getListingsForServer).not.toHaveBeenCalled();
  });

  it("prisma failure yields an EMPTY publishable set, loudly — never the fixture corpus as a stand-in", async () => {
    state.prismaMode = true;
    mocks.getCitiesForServer.mockRejectedValue(new Error("ECONNREFUSED"));
    mocks.getLocalitiesForServer.mockRejectedValue(new Error("ECONNREFUSED"));
    mocks.getListingsForServer.mockRejectedValue(new Error("ECONNREFUSED"));
    mocks.getAgentDirectoryForServer.mockRejectedValue(new Error("ECONNREFUSED"));
    const publishable = await getPublishableSeoPagesForServer();
    expect(publishable).toEqual([]);
    const { logger } = await import("@/lib/observability/logger");
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "seo.registry_prisma_failed" }), expect.any(String));
  });

  it("prisma mode builds only from the DB set and re-fetches after the TTL", async () => {
    state.prismaMode = true;
    mocks.getCitiesForServer.mockResolvedValue([]);
    mocks.getLocalitiesForServer.mockResolvedValue([]);
    mocks.getListingsForServer.mockResolvedValue([]);
    mocks.getAgentDirectoryForServer.mockResolvedValue([]);

    const first = await getServerSeoRegistry();
    expect(first.source).toBe("prisma");
    /* No data ⇒ only standing pages (home, hubs, guides); no listing, locality or city pages. */
    expect(first.pages.filter((page) => page.routeType === "listing")).toEqual([]);
    expect(first.pages.filter((page) => page.routeType === "locality")).toEqual([]);
    expect(first.pages.filter((page) => page.routeType === "city")).toEqual([]);

    /* Within the TTL, one composition serves every sitemap request. */
    await getServerSeoRegistry();
    expect(mocks.getListingsForServer).toHaveBeenCalledTimes(1);
  });
});
