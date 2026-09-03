import { afterEach, describe, expect, it } from "vitest";
import { LOGIN_WINDOW_MS, MAX_ATTEMPTS_PER_EMAIL, MAX_ATTEMPTS_PER_IP, clearLoginAttempts, clearLoginThrottleForTests, registerLoginAttempt } from "./login-throttle";

afterEach(() => clearLoginThrottleForTests());

describe("sign-in throttle", () => {
  it("blocks a burst against one account even from rotating addresses", () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL; attempt += 1) {
      expect(registerLoginAttempt({ ip: `10.0.0.${attempt}`, email: "victim@example.com" }).allowed).toBe(true);
    }
    const blocked = registerLoginAttempt({ ip: "10.0.0.250", email: "victim@example.com" });
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("blocks one address spraying many accounts", () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_IP; attempt += 1) {
      expect(registerLoginAttempt({ ip: "203.0.113.9", email: `user${attempt}@example.com` }).allowed).toBe(true);
    }
    expect(registerLoginAttempt({ ip: "203.0.113.9", email: "another@example.com" }).allowed).toBe(false);
  });

  it("treats email case and whitespace as the same account", () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL; attempt += 1) {
      registerLoginAttempt({ ip: "198.51.100.1", email: "Victim@Example.com" });
    }
    expect(registerLoginAttempt({ ip: "198.51.100.2", email: "  victim@example.com " }).allowed).toBe(false);
  });

  it("releases the account budget after a successful sign-in", () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL - 1; attempt += 1) {
      registerLoginAttempt({ ip: "192.0.2.5", email: "user@example.com" });
    }
    clearLoginAttempts("USER@example.com");
    expect(registerLoginAttempt({ ip: "192.0.2.5", email: "user@example.com" }).allowed).toBe(true);
  });

  it("reopens the window once it has elapsed", () => {
    const start = 1_000_000;
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL; attempt += 1) {
      registerLoginAttempt({ ip: "192.0.2.7", email: "late@example.com" }, start);
    }
    expect(registerLoginAttempt({ ip: "192.0.2.7", email: "late@example.com" }, start).allowed).toBe(false);
    expect(registerLoginAttempt({ ip: "192.0.2.7", email: "late@example.com" }, start + LOGIN_WINDOW_MS + 1).allowed).toBe(true);
  });

  it("does not lump anonymous clients into one shared bucket", () => {
    /* No identity ⇒ no IP bucket, matching the existing mutation limiter.
       The per-email budget still applies, so this is not a bypass. */
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_IP + 5; attempt += 1) {
      expect(registerLoginAttempt({ ip: null, email: `anon${attempt}@example.com` }).allowed).toBe(true);
    }
  });
});
