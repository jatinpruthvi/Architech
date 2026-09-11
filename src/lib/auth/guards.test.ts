import { describe, expect, it, vi } from "vitest";
import { authorizeRequest, isAuthorized } from "./guards";

describe("server route authorization guard", () => {
  it("rejects an explicitly anonymous request", async () => {
    const access = await authorizeRequest(new Request("http://example.com/api/private?mode=none"), { permission: "broker.dashboard.read" });
    expect(isAuthorized(access)).toBe(false);
    if (!isAuthorized(access)) expect(access.response.status).toBe(401);
  });

  it("reports missing Better Auth configuration instead of falling through", async () => {
    const access = await authorizeRequest(new Request("http://example.com/api/private?source=better-auth"), { permission: "broker.dashboard.read" });
    expect(isAuthorized(access)).toBe(false);
    if (!isAuthorized(access)) expect(access.response.status).toBe(503);
  });

  it("allows a demo broker session only outside production", async () => {
    const previous = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "test");
    const access = await authorizeRequest(new Request("http://example.com/api/private"), { permission: "listing.draft.create" });
    expect(isAuthorized(access)).toBe(true);
    if (previous === undefined) vi.unstubAllEnvs(); else vi.stubEnv("NODE_ENV", previous);
  });

  it("rejects an ungranted permission", async () => {
    const access = await authorizeRequest(new Request("http://example.com/api/private"), { permission: "platform.root" });
    expect(isAuthorized(access)).toBe(false);
    if (!isAuthorized(access)) expect(access.response.status).toBe(403);
  });
});
