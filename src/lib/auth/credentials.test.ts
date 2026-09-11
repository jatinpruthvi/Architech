import { describe, expect, it } from "vitest";
import { INVALID_CREDENTIALS_MESSAGE, PASSWORD_MIN_LENGTH, normalizeEmail, validateSignIn, validateSignUp } from "./credentials";

describe("credential validation", () => {
  it("normalizes email case and surrounding whitespace", () => {
    expect(normalizeEmail("  Broker-Admin@Example.COM ")).toBe("broker-admin@example.com");
    const result = validateSignIn({ email: " USER@Example.com ", password: "password123" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("user@example.com");
  });

  it("rejects malformed email addresses", () => {
    for (const email of ["", "nope", "no@tld", "a b@example.com", "double..dot@example.com".replace("double..dot", "a@@b")]) {
      const result = validateSignIn({ email, password: "password123" });
      expect(result.ok, email).toBe(false);
      if (!result.ok) expect(result.issues.some((issue) => issue.field === "email")).toBe(true);
    }
  });

  it("enforces the password floor that Better Auth itself enforces", () => {
    const short = validateSignIn({ email: "a@b.com", password: "x".repeat(PASSWORD_MIN_LENGTH - 1) });
    expect(short.ok).toBe(false);
    const exact = validateSignIn({ email: "a@b.com", password: "x".repeat(PASSWORD_MIN_LENGTH) });
    expect(exact.ok).toBe(true);
  });

  it("rejects an over-long password rather than forwarding it to the hasher", () => {
    const result = validateSignIn({ email: "a@b.com", password: "x".repeat(500) });
    expect(result.ok).toBe(false);
  });

  it("reports every failing field at once so the form is fixable in one pass", () => {
    const result = validateSignUp({ name: "", email: "bad", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.field).sort()).toEqual(["email", "listerType", "name", "password"]);
  });

  it("trims the registered name", () => {
    const result = validateSignUp({ name: "  Ananya Sharma  ", email: "a@b.com", password: "password123", listerType: "OWNER" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe("Ananya Sharma");
  });

  it("requires an explicit owner/broker declaration at sign-up", () => {
    const missing = validateSignUp({ name: "Ananya Sharma", email: "a@b.com", password: "password123" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.issues.some((issue) => issue.field === "listerType")).toBe(true);

    const junk = validateSignUp({ name: "Ananya Sharma", email: "a@b.com", password: "password123", listerType: "ADMIN" });
    expect(junk.ok).toBe(false);
  });

  it("normalizes the declaration to a reviewed code", () => {
    const result = validateSignUp({ name: "Ananya Sharma", email: "a@b.com", password: "password123", listerType: "agent" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.listerType).toBe("BROKER");
  });

  it("keeps a single failure message so the form cannot enumerate accounts", () => {
    expect(INVALID_CREDENTIALS_MESSAGE).not.toMatch(/no account|unknown|not found|wrong password/i);
  });
});
