import { afterEach, describe, expect, it } from "vitest";
import {
  LOGIN_WINDOW_MS,
  MAX_ATTEMPTS_PER_EMAIL,
  MAX_ATTEMPTS_PER_IP,
  MAX_LOGIN_THROTTLE_BUCKETS,
  clearLoginAttempts,
  clearLoginThrottleForTests,
  loginThrottleBucketCount,
  registerLoginAttempt,
} from "./login-throttle";

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

  /* BUG-R4-003 (P2, security/availability): `ipBuckets` and `emailBuckets` were
     never pruned — the only cleanup was `clearLoginAttempts` (per successful
     sign-in) and the test-only `clearLoginThrottleForTests()`. POST
     /api/auth/login passes the request body's `email` straight into
     `registerLoginAttempt` (credential-flow.ts:133) after nothing more than a
     SHAPE check, so an attacker spraying syntactically valid but distinct
     addresses mints one permanent Map entry per address, retained for the whole
     process lifetime. The 15-minute window makes each entry outlive the
     60-second mutation-limiter windows by 15x. Same class as BUG-R4-001/002. */
  it("BUG-R4-003: the email bucket map stays bounded under a sprayed address space", () => {
    for (let attempt = 0; attempt < MAX_LOGIN_THROTTLE_BUCKETS + 2000; attempt += 1) {
      registerLoginAttempt({ ip: "203.0.113.7", email: `spray${attempt}@example.com` });
    }
    expect(loginThrottleBucketCount().email).toBeLessThanOrEqual(MAX_LOGIN_THROTTLE_BUCKETS);
  });

  it("BUG-R4-003: the ip bucket map stays bounded under rotating addresses", () => {
    for (let attempt = 0; attempt < MAX_LOGIN_THROTTLE_BUCKETS + 2000; attempt += 1) {
      registerLoginAttempt({ ip: `198.18.${attempt % 256}.${(attempt >> 8) % 256}`, email: "one@example.com" });
    }
    expect(loginThrottleBucketCount().ip).toBeLessThanOrEqual(MAX_LOGIN_THROTTLE_BUCKETS);
  });

  it("BUG-R4-003: expired windows are reclaimed instead of retained forever", () => {
    const start = 1_000_000;
    for (let attempt = 0; attempt < MAX_LOGIN_THROTTLE_BUCKETS; attempt += 1) {
      registerLoginAttempt({ ip: `198.51.${attempt % 256}.${(attempt >> 8) % 256}`, email: `held${attempt}@example.com` }, start);
    }
    expect(loginThrottleBucketCount().email).toBe(MAX_LOGIN_THROTTLE_BUCKETS);
    /* Every window has now lapsed, so the next fresh address must trigger a
       sweep that reclaims them rather than growing past the ceiling. */
    registerLoginAttempt({ ip: "192.0.2.9", email: "fresh@example.com" }, start + LOGIN_WINDOW_MS + 1);
    expect(loginThrottleBucketCount().email).toBe(1);
  });

  it("BUG-R4-003: pruning never weakens the per-account or per-address budget", () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_EMAIL; attempt += 1) {
      expect(registerLoginAttempt({ ip: "203.0.113.44", email: "victim@example.com" }).allowed).toBe(true);
    }
    expect(registerLoginAttempt({ ip: "203.0.113.45", email: "victim@example.com" }).allowed).toBe(false);
  });
});
