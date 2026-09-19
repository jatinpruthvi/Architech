import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/guards", () => ({
  authorizeRequest: vi.fn(),
  isAuthorized: () => false,
}));
vi.mock("@/lib/technoproperty/repository", () => ({
  createBuyerLead: vi.fn(),
  listBuyerLeads: vi.fn(),
}));

import { parseLeadBody } from "./route";

const payload = (over: Record<string, unknown> = {}) => ({
  name: "Meera Shah",
  phone: "98765 43210",
  dealType: "RENT",
  ...over,
});

describe("buyer-lead payload contract", () => {
  /* BUG-R5-001: the route's own budget check must enforce the same ₹10 crore
     ceiling the form promises / the repository enforces; it read
     1_000_000_000 (₹100 crore) for a bound the copy calls ₹10 crore. */
  it("BUG-R5-001: rejects a budget past the documented ₹10 crore ceiling", () => {
    expect(parseLeadBody(payload({ budgetValue: 100_000_001 }))).toEqual({ error: "INVALID_BUDGET" });
    expect(parseLeadBody(payload({ budgetValue: 1_000_000_000 }))).toEqual({ error: "INVALID_BUDGET" });
  });

  it("BUG-R5-001: accepts the exact ₹10 crore ceiling", () => {
    const parsed = parseLeadBody(payload({ budgetValue: 100_000_000 }));
    expect("error" in parsed).toBe(false);
    if (!("error" in parsed)) expect(parsed.budgetValue).toBe(100_000_000);
  });
});
