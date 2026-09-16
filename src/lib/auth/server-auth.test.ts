import { describe, it, expect, vi, afterEach } from "vitest";
import { getAuthServer, resetAuthServerForTests } from "./server-auth";

describe("getAuthServer", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetAuthServerForTests();
  });

  it("returns a singleton instance", () => {
    const auth1 = getAuthServer();
    const auth2 = getAuthServer();
    expect(auth1).toBe(auth2);
  });

  it("creates a new instance after resetAuthServerForTests is called", () => {
    const auth1 = getAuthServer();
    resetAuthServerForTests();
    const auth2 = getAuthServer();
    expect(auth1).not.toBe(auth2);
  });

  it("configures with default values when env vars are undefined", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", undefined as unknown as string);
    vi.stubEnv("BETTER_AUTH_URL", undefined as unknown as string);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined as unknown as string);
    vi.stubEnv("TRUST_PROXY_HEADERS", undefined as unknown as string);

    // Some tests may run with a pre-existing environment variable in the process, so let's delete them to be sure
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.TRUST_PROXY_HEADERS;

    const auth = getAuthServer();
    expect(auth.options.secret).toBe("dev-only-secret-change-me");
    expect(auth.options.baseURL).toBe("http://localhost:3000");
    expect(auth.options.trustedOrigins).toEqual([]);
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["x-real-ip", "cf-connecting-ip"]);
  });

  it("configures with environment variables when provided", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "super-secret");
    vi.stubEnv("BETTER_AUTH_URL", "https://auth.example.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://site.example.com");
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");

    const auth = getAuthServer();
    expect(auth.options.secret).toBe("super-secret");
    expect(auth.options.baseURL).toBe("https://auth.example.com");
    expect(auth.options.trustedOrigins).toEqual(["https://auth.example.com", "https://site.example.com"]);
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual(["x-real-ip", "cf-connecting-ip", "x-forwarded-for"]);
  });

  it("handles unparseable URLs in trustedOrigins gracefully", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://auth.example.com"); // Need a valid base URL for Better Auth
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "not-a-url"); // But the secondary one can be unparseable

    const auth = getAuthServer();
    expect(auth.options.trustedOrigins).toEqual(["https://auth.example.com"]);
  });

  it("deduplicates trustedOrigins if env vars point to the same origin", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://example.com/api/auth");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");

    const auth = getAuthServer();
    expect(auth.options.trustedOrigins).toEqual(["https://example.com"]);
  });
});
