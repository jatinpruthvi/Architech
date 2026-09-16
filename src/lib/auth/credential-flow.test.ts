import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWithCredentials, signInWithCredentials, signOutCookies } from "./credential-flow";
import { getAuthSourceMode } from "./source";
import { getAuthServer } from "./server-auth";
import { getSessionContractForRequest } from "./live";
import { clearLoginAttempts, registerLoginAttempt } from "./login-throttle";
import { DEMO_ACCOUNTS } from "./demo-accounts";
import { BETTER_AUTH_SESSION_COOKIE } from "./live-session";
import type { AuthSession } from "./roles";

vi.mock("./source", () => ({
  getAuthSourceMode: vi.fn(),
}));

vi.mock("./server-auth", () => ({
  getAuthServer: vi.fn(),
}));

vi.mock("./live", () => ({
  getSessionContractForRequest: vi.fn(),
}));

vi.mock("./login-throttle", () => ({
  registerLoginAttempt: vi.fn(),
  clearLoginAttempts: vi.fn(),
}));

const mockSession: AuthSession = {
  user: { id: "user-1", name: "Test User", email: "test@example.com", role: "BUYER" },
  permissions: [],
  source: "better-auth-live",
};

describe("credential-flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthSourceMode as any).mockReturnValue("better-auth");
    (registerLoginAttempt as any).mockReturnValue({ allowed: true });
  });

  describe("signInWithCredentials", () => {
    it("rejects invalid input", async () => {
      const request = new Request("http://localhost:3000/");
      const result = await signInWithCredentials(request, { email: "bad-email", password: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.code).toBe("INVALID_CREDENTIALS_INPUT");
        expect(result.issues.length).toBeGreaterThan(0);
      }
    });

    it("respects login throttling", async () => {
      (registerLoginAttempt as any).mockReturnValue({ allowed: false, retryAfterSeconds: 60 });
      const request = new Request("http://localhost:3000/");
      const result = await signInWithCredentials(request, { email: "test@example.com", password: "password123" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(429);
        expect(result.retryAfterSeconds).toBe(60);
      }
    });

    describe("in demo mode", () => {
      beforeEach(() => {
        (getAuthSourceMode as any).mockReturnValue("demo");
      });

      it("authenticates a valid demo account", async () => {
        const demoAccount = DEMO_ACCOUNTS[0];
        const request = new Request("http://localhost:3000/");
        const result = await signInWithCredentials(request, { email: demoAccount.email, password: demoAccount.password });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.session).toEqual(demoAccount.session);
          expect(result.cookies.length).toBe(1);
          expect(result.cookies[0]).toContain(encodeURIComponent(demoAccount.id));
        }
      });

      it("rejects an invalid demo account", async () => {
        const request = new Request("http://localhost:3000/");
        const result = await signInWithCredentials(request, { email: "nonexistent@example.com", password: "password123" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(401);
          expect(result.code).toBe("INVALID_CREDENTIALS");
        }
      });
    });

    describe("in live mode", () => {
      it("passes through 429 from provider", async () => {
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 429 })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });

        const request = new Request("http://localhost:3000/");
        const result = await signInWithCredentials(request, { email: "test@example.com", password: "password123" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(429);
          expect(result.code).toBe("TOO_MANY_ATTEMPTS");
        }
      });

      it("returns 401 if provider returns non-200", async () => {
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 400 })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });

        const request = new Request("http://localhost:3000/");
        const result = await signInWithCredentials(request, { email: "test@example.com", password: "password123" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(401);
        }
      });

      it("returns 401 if provider mints no cookies", async () => {
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 200 })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });

        const request = new Request("http://localhost:3000/");
        const result = await signInWithCredentials(request, { email: "test@example.com", password: "password123" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(401);
        }
      });

      it("returns 401 if session contract fails to resolve", async () => {
        const mockHeaders = new Headers();
        mockHeaders.append("set-cookie", "session=123");
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 200, headers: mockHeaders })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });
        (getSessionContractForRequest as any).mockResolvedValue({ session: null });

        const request = new Request("http://localhost:3000/");
        const result = await signInWithCredentials(request, { email: "test@example.com", password: "password123" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(401);
        }
      });

      it("succeeds when provider mints cookies and session resolves", async () => {
        const mockHeaders = new Headers();
        mockHeaders.append("set-cookie", "session=123");
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 200, headers: mockHeaders })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });
        (getSessionContractForRequest as any).mockResolvedValue({ session: mockSession });

        const request = new Request("http://localhost:3000/");
        const result = await signInWithCredentials(request, { email: "test@example.com", password: "password123" });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.session).toEqual(mockSession);
          expect(result.cookies).toEqual(["session=123"]);
        }
        expect(clearLoginAttempts).toHaveBeenCalledWith("test@example.com");
      });
    });
  });

  describe("registerWithCredentials", () => {
    it("rejects invalid input", async () => {
      const request = new Request("http://localhost:3000/");
      const result = await registerWithCredentials(request, { email: "bad-email", password: "short", name: "", listerType: "invalid" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.code).toBe("INVALID_CREDENTIALS_INPUT");
        expect(result.issues.length).toBeGreaterThan(0);
      }
    });

    it("rejects in demo mode", async () => {
      (getAuthSourceMode as any).mockReturnValue("demo");
      const request = new Request("http://localhost:3000/");
      const result = await registerWithCredentials(request, { email: "test@example.com", password: "password123", name: "Test User", listerType: "OWNER" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(503);
        expect(result.code).toBe("REGISTRATION_UNAVAILABLE");
      }
    });

    describe("in live mode", () => {
      it("passes through 429 from provider", async () => {
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 429 })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });

        const request = new Request("http://localhost:3000/");
        const result = await registerWithCredentials(request, { email: "test@example.com", password: "password123", name: "Test User", listerType: "OWNER" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(429);
        }
      });

      it("returns 409 if provider indicates account exists", async () => {
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: "User already exists" }), { status: 422 })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });

        const request = new Request("http://localhost:3000/");
        const result = await registerWithCredentials(request, { email: "test@example.com", password: "password123", name: "Test User", listerType: "OWNER" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.status).toBe(409);
          expect(result.code).toBe("ACCOUNT_EXISTS");
        }
      });

      it("succeeds when provider mints cookies and session resolves", async () => {
        const mockHeaders = new Headers();
        mockHeaders.append("set-cookie", "session=123");
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({}), { status: 200, headers: mockHeaders })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });
        (getSessionContractForRequest as any).mockResolvedValue({ session: mockSession });

        const request = new Request("http://localhost:3000/");
        const result = await registerWithCredentials(request, { email: "test@example.com", password: "password123", name: "Test User", listerType: "OWNER" });

        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.session).toEqual(mockSession);
          expect(result.cookies).toEqual(["session=123"]);
        }
      });
    });
  });

  describe("signOutCookies", () => {
    it("returns explicit signed-out cookie in demo mode", async () => {
      (getAuthSourceMode as any).mockReturnValue("demo");
      const request = new Request("http://localhost:3000/");
      const cookies = await signOutCookies(request);
      expect(cookies.length).toBe(1);
      expect(cookies[0]).toContain("signed-out");
    });

    describe("in live mode", () => {
      it("returns provider cookies if they exist", async () => {
        const mockHeaders = new Headers();
        mockHeaders.append("set-cookie", "cleared=true");
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 200, headers: mockHeaders })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });

        const request = new Request("http://localhost:3000/");
        const cookies = await signOutCookies(request);
        expect(cookies).toEqual(["cleared=true"]);
      });

      it("returns fallback clearing cookie if provider returns none", async () => {
        const mockHandler = vi.fn().mockResolvedValue(
          new Response(null, { status: 200 })
        );
        (getAuthServer as any).mockReturnValue({ handler: mockHandler });

        const request = new Request("https://localhost:3000/");
        const cookies = await signOutCookies(request);
        expect(cookies.length).toBe(1);
        expect(cookies[0]).toContain(`${BETTER_AUTH_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Secure`);
      });
    });
  });
});
