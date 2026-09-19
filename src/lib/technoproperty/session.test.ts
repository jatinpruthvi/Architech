import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AuthSession } from "@/lib/auth/roles";

/* The session reader had no tests at all before PERF-R5-003, although it is the
   auth gate for the whole broker workspace. These pin the contract the
   `cache()` wrapper must not have changed (what it returns, what it forwards,
   and the two errors `requireTechnoSession` promises), plus the wrapper itself
   — see the last test for why the memo is pinned structurally. */

const state = vi.hoisted(() => ({
  cookie: "architech.demo=broker-admin",
  contract: { session: null as AuthSession | null, source: "better-auth-live" as string, missing: [] as string[] },
  requests: [] as Request[],
  calls: 0,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ toString: () => state.cookie }),
}));

vi.mock("@/lib/auth/live", () => ({
  getSessionContractForRequest: async (request: Request) => {
    state.calls += 1;
    state.requests.push(request);
    return { session: state.contract.session, source: state.contract.source, missing: state.contract.missing };
  },
}));

import { getTechnoSession, requireTechnoSession } from "./session";

const session = (over: Partial<AuthSession> = {}): AuthSession =>
  ({
    user: { id: "user-1", name: "Broker", email: "broker@architech.test", role: "BROKER_MEMBER" },
    organization: { id: "org-1", name: "Agency", slug: "agency" },
    permissions: ["broker.dashboard.read"],
    source: "better-auth-live",
    ...over,
  }) as AuthSession;

beforeEach(() => {
  state.cookie = "architech.demo=broker-admin";
  state.contract = { session: session(), source: "better-auth-live", missing: [] };
  state.requests = [];
  state.calls = 0;
});

describe("getTechnoSession", () => {
  it("returns the session from the request contract", async () => {
    const result = await getTechnoSession();
    expect(result?.user.id).toBe("user-1");
    expect(result?.organization?.id).toBe("org-1");
  });

  it("returns null when the contract has no session", async () => {
    state.contract = { session: null, source: "better-auth-live", missing: [] };
    expect(await getTechnoSession()).toBeNull();
  });

  /* The synthetic Request is how the cookie jar reaches the auth layer — if
     this stops being forwarded the reader silently becomes anonymous. */
  it("forwards the request cookie header and a broker URL", async () => {
    await getTechnoSession();
    const request = state.requests[0];
    expect(request.headers.get("cookie")).toBe("architech.demo=broker-admin");
    expect(new URL(request.url).pathname).toBe("/broker");
  });
});

describe("requireTechnoSession", () => {
  it("returns the session when the organization is present", async () => {
    expect((await requireTechnoSession()).organization?.id).toBe("org-1");
  });

  it("throws TECHNO_NO_SESSION when nobody is signed in", async () => {
    state.contract = { session: null, source: "better-auth-live", missing: [] };
    await expect(requireTechnoSession()).rejects.toThrow("TECHNO_NO_SESSION");
  });

  it("throws TECHNO_NO_ORG when the session has no organization", async () => {
    state.contract = { session: session({ organization: undefined }), source: "better-auth-live", missing: [] };
    await expect(requireTechnoSession()).rejects.toThrow("TECHNO_NO_ORG");
  });
});

describe("PERF-R5-003: the reader is memoised per request", () => {
  /* Why a source pin instead of a call-count assertion: React's `cache` only
     dedupes inside a render scope, and there is no RSC renderer in this suite,
     so outside one the wrapper calls through by design (a count assertion here
     would pass for the wrong reason). The house already handles this class the
     same way — see the listing page's P0.5 note, which pins the same idea in
     prose. This test fails if the wrapper is dropped, and it says what the
     cost of dropping it is. */
  it("wraps getTechnoSession in React cache()", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const src = readFileSync(join(root, "src/lib/technoproperty/session.ts"), "utf8");
    expect(
      /export const getTechnoSession = cache\(/.test(src),
      "getTechnoSession must stay wrapped in React cache(): the (techno) layout and " +
        "each page below it resolve the session independently, so without it every " +
        "broker navigation pays for two Better Auth resolutions (PERF-R5-003).",
    ).toBe(true);
  });
});
