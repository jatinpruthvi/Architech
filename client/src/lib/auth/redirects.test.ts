import { describe, expect, it } from "vitest";
import { BROKER_LANDING, DEFAULT_BUYER_LANDING, LOGIN_PATH, MODERATOR_LANDING, landingPathForSession, loginUrlFor, resolvePostLoginPath, safeNextPath } from "./redirects";
import { demoBrokerSession, permissionsForRole, type AuthSession } from "./roles";

const buyer: AuthSession = {
  user: { id: "u", name: "Buyer", email: "buyer@example.com", role: "BUYER" },
  permissions: permissionsForRole("BUYER"),
  source: "better-auth-live",
};

const moderator: AuthSession = {
  user: { id: "m", name: "Moderator", email: "mod@example.com", role: "MODERATOR" },
  permissions: permissionsForRole("MODERATOR"),
  source: "better-auth-live",
};

describe("post-login redirect safety", () => {
  it("accepts same-site absolute paths", () => {
    expect(safeNextPath("/broker/leads/")).toBe("/broker/leads/");
    expect(safeNextPath("/search/?city=pune")).toBe("/search/?city=pune");
  });

  it("refuses off-site destinations (open redirect)", () => {
    for (const hostile of [
      "https://evil.example.com/",
      "//evil.example.com",
      "/\\evil.example.com",
      "javascript:alert(1)",
      "http://evil.example.com",
      "evil.example.com",
    ]) {
      expect(safeNextPath(hostile), hostile).toBeNull();
    }
  });

  it("refuses control characters used to smuggle a second header or path", () => {
    expect(safeNextPath("/ok\nLocation: https://evil.example.com")).toBeNull();
    expect(safeNextPath("/ok\u0000")).toBeNull();
  });

  it("refuses a next value that points back at the login page (redirect loop)", () => {
    expect(safeNextPath("/login/")).toBeNull();
    expect(safeNextPath("/login/?mode=register")).toBeNull();
  });

  it("sends each role to a landing page it can actually open", () => {
    expect(landingPathForSession(demoBrokerSession)).toBe(BROKER_LANDING);
    expect(landingPathForSession(moderator)).toBe(MODERATOR_LANDING);
    expect(landingPathForSession(buyer)).toBe(DEFAULT_BUYER_LANDING);
    expect(landingPathForSession(null)).toBe(LOGIN_PATH);
  });

  it("does not send a broker-roled session without an organization to the broker dashboard", () => {
    /* The server gate requires role AND membership; a landing page that ignored
       membership would bounce the user straight back out. */
    const orphan = { ...demoBrokerSession, organization: undefined };
    expect(landingPathForSession(orphan)).not.toBe(BROKER_LANDING);
  });

  it("prefers a safe requested destination over the role default", () => {
    expect(resolvePostLoginPath(buyer, "/search/?city=pune")).toBe("/search/?city=pune");
    expect(resolvePostLoginPath(buyer, "https://evil.example.com")).toBe(DEFAULT_BUYER_LANDING);
  });

  it("builds a login URL that encodes the blocked destination", () => {
    expect(loginUrlFor("/broker/leads/")).toBe(`${LOGIN_PATH}?next=${encodeURIComponent("/broker/leads/")}`);
    expect(loginUrlFor("/login/")).toBe(LOGIN_PATH);
  });
});
