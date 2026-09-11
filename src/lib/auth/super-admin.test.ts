import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionContractForRequest } from "./live";
import { SUPER_ADMIN_COOKIE, SUPER_ADMIN_TTL_SECONDS, mintSuperAdminCookieValue, parseSuperAdminHash, superAdminSessionFromCookie, verifySuperAdminPassword } from "./super-admin";

const TEST_SECRET = "unit-test-better-auth-secret";

function storedHashFor(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

beforeEach(() => vi.stubEnv("ARCHITECH_AUTH_SOURCE", "demo"));
afterEach(() => vi.unstubAllEnvs());

describe("super-admin credential (spec §6.1)", () => {
  it("verifies a correctly stored hash", () => {
    const stored = storedHashFor("correct-horse-battery-staple");
    expect(verifySuperAdminPassword("correct-horse-battery-staple", stored)).toBe(true);
  });

  it("rejects a wrong password and malformed storage without throwing", () => {
    const stored = storedHashFor("correct-horse-battery-staple");
    expect(verifySuperAdminPassword("wrong-password", stored)).toBe(false);
    expect(verifySuperAdminPassword("anything", undefined)).toBe(false);
    expect(verifySuperAdminPassword("anything", "not-a-hash")).toBe(false);
    expect(verifySuperAdminPassword("anything", "scrypt$zz$zz")).toBe(false);
  });

  it("parseSuperAdminHash round-trips and rejects bad format", () => {
    const stored = storedHashFor("x".repeat(12));
    const parsed = parseSuperAdminHash(stored);
    expect(parsed?.salt).toHaveLength(16);
    expect(parsed?.hash).toHaveLength(32);
    expect(parseSuperAdminHash(undefined)).toBeNull();
    expect(parseSuperAdminHash("argon2id$v=19$xx")).toBeNull();
  });
});

describe("super-admin cookie (spec §6.2/§6.3)", () => {
  const expires = new Date(Date.now() + SUPER_ADMIN_TTL_SECONDS * 1000);

  it("accepts a valid, unexpired cookie and builds the minimal session", () => {
    const value = mintSuperAdminCookieValue(expires, TEST_SECRET);
    const session = superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, TEST_SECRET);
    expect(session?.user.role).toBe("SUPER_ADMIN");
    expect(session?.permissions).toEqual(["admin.plans.read", "admin.plans.write"]);
    expect(session?.organization).toBeUndefined();
    expect(session?.source).toBe("super-admin");
  });

  it("rejects a tampered signature", () => {
    const value = mintSuperAdminCookieValue(expires, TEST_SECRET);
    const [epoch, sig] = value.split(".");
    const tampered = `${epoch}.${(sig === "0".repeat(sig.length) ? "1" : "0").repeat(sig.length)}`;
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${tampered}`, TEST_SECRET)).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const value = mintSuperAdminCookieValue(new Date(Date.now() - 1000), TEST_SECRET);
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, TEST_SECRET)).toBeNull();
  });

  it("rejects a different signing secret and a missing secret", () => {
    const value = mintSuperAdminCookieValue(expires, "another-secret");
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, TEST_SECRET)).toBeNull();
    expect(superAdminSessionFromCookie(`${SUPER_ADMIN_COOKIE}=${value}`, undefined)).toBeNull();
  });

  it("the session contract resolves a super-admin cookie in demo mode", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", TEST_SECRET);
    const value = mintSuperAdminCookieValue(expires, TEST_SECRET);
    const contract = await getSessionContractForRequest(new Request("http://localhost/admin/plans", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=${value}` } }));
    expect(contract.session?.user.role).toBe("SUPER_ADMIN");
  });

  it("a garbage cookie falls through to the normal demo session", async () => {
    const contract = await getSessionContractForRequest(new Request("http://localhost/", { headers: { cookie: `${SUPER_ADMIN_COOKIE}=garbage` } }));
    expect(contract.session?.user.role).not.toBe("SUPER_ADMIN");
  });
});
