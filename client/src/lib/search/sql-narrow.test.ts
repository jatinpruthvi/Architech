import { describe, expect, it, vi } from "vitest";
import { narrowListingIdsForQuery, sqlNarrowEnabled } from "./sql-narrow";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/repositories/server/prisma", () => ({ getPrismaClient: () => { throw new Error("should not be called without an injected client"); } }));
vi.mock("@/lib/observability/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

describe("sqlNarrowEnabled", () => {
  it("is off unless explicitly turned on", () => {
    expect(sqlNarrowEnabled({})).toBe(false);
    expect(sqlNarrowEnabled({ ARCHITECH_SEARCH_SQL_NARROW: "off" })).toBe(false);
    expect(sqlNarrowEnabled({ ARCHITECH_SEARCH_SQL_NARROW: "ON" })).toBe(true);
    expect(sqlNarrowEnabled({ ARCHITECH_SEARCH_SQL_NARROW: "on" })).toBe(true);
  });
});

describe("narrowListingIdsForQuery", () => {
  it("reports not-required for structured-only queries without hitting the DB", async () => {
    const client = { $queryRawUnsafe: vi.fn() };
    expect(await narrowListingIdsForQuery("380059", client)).toEqual({ state: "not-required" });
    expect(client.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("executes the plan with positional params and returns stable ids", async () => {
    const client = { $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: "l1" }, { id: "l2" }, { id: "" }]) };
    const outcome = await narrowListingIdsForQuery("courtyard in paldi", client);
    expect(outcome).toEqual({ state: "executed", ids: ["l1", "l2"], candidates: 2 });
    const [sql, ...params] = client.$queryRawUnsafe.mock.calls[0] as unknown[];
    expect(typeof sql).toBe("string");
    expect(params).toEqual(["%courtyard%", "courtyard", "%paldi%", "paldi"]);
  });

  it("falls back loudly (never throws) when SQL fails", async () => {
    const client = { $queryRawUnsafe: vi.fn().mockRejectedValue(new Error('extension "pg_trgm" is not available')) };
    const outcome = await narrowListingIdsForQuery("thaltej", client);
    expect(outcome.state).toBe("fallback");
    if (outcome.state === "fallback") expect(outcome.reason).toContain("pg_trgm");
  });
});
