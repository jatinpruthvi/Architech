/* How each panel behaves when its request does NOT succeed.
 *
 * This is the failure class that produced the worst bug in this feature: a
 * 403 was swallowed, an empty array was returned, and the owner dashboard
 * announced "No properties listed yet" to someone who might have had ten.
 *
 * The distinction under test throughout: "you have nothing" and "we could not
 * look" are different statements, and only the first may ever be shown as an
 * empty state.
 */
import { describe, expect, it } from "vitest";
import { itemsOf, loadPanel, mayClaimEmpty, pickArray } from "./load-panel";

function respondWith(status: number, payload: unknown, ok?: boolean) {
  return async () =>
    ({
      ok: ok ?? (status >= 200 && status < 300),
      status,
      json: async () => payload,
    }) as Response;
}

function respondWithInvalidJson(status = 200) {
  return async () =>
    ({
      ok: true,
      status,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    }) as unknown as Response;
}

describe("loading a dashboard panel", () => {
  describe("success", () => {
    it("returns the rows for a healthy response", async () => {
      const outcome = await loadPanel<{ id: string }>("/api/x/", "items", respondWith(200, { ok: true, items: [{ id: "a" }] }));
      expect(outcome).toEqual({ state: "ok", items: [{ id: "a" }] });
      expect(mayClaimEmpty(outcome)).toBe(false);
    });

    it("treats a genuinely empty list as empty, which IS claimable", async () => {
      const outcome = await loadPanel("/api/x/", "items", respondWith(200, { ok: true, items: [] }));
      expect(outcome).toEqual({ state: "ok", items: [] });
      expect(mayClaimEmpty(outcome)).toBe(true);
    });

    it("tolerates a missing or wrong-typed key without inventing rows", async () => {
      expect(await loadPanel("/api/x/", "items", respondWith(200, { ok: true }))).toEqual({ state: "ok", items: [] });
      expect(await loadPanel("/api/x/", "items", respondWith(200, { ok: true, items: "nope" }))).toEqual({ state: "ok", items: [] });
    });
  });

  describe("failures must never be reported as emptiness", () => {
    it("reports 403 as forbidden, not as an empty panel", async () => {
      /* The exact bug: the owner dashboard's 403 became "No properties yet". */
      const outcome = await loadPanel("/api/broker/listings/", "drafts", respondWith(403, { ok: false }));
      expect(outcome.state).toBe("forbidden");
      expect(mayClaimEmpty(outcome)).toBe(false);
      expect(itemsOf(outcome)).toEqual([]);
    });

    it("reports 401 as forbidden", async () => {
      expect((await loadPanel("/api/x/", "items", respondWith(401, {}))).state).toBe("forbidden");
    });

    it("reports a server error as unavailable", async () => {
      for (const status of [500, 502, 503]) {
        const outcome = await loadPanel("/api/x/", "items", respondWith(status, {}));
        expect(outcome.state, `HTTP ${status}`).toBe("unavailable");
        expect(mayClaimEmpty(outcome)).toBe(false);
      }
    });

    it("reports a network failure as unavailable", async () => {
      const outcome = await loadPanel("/api/x/", "items", async () => { throw new TypeError("Failed to fetch"); });
      expect(outcome.state).toBe("unavailable");
      expect(mayClaimEmpty(outcome)).toBe(false);
    });

    it("reports malformed JSON as unavailable, not as an empty list", async () => {
      /* An HTML error page served with a 200 is the classic proxy failure. */
      const outcome = await loadPanel("/api/x/", "items", respondWithInvalidJson());
      expect(outcome.state).toBe("unavailable");
      expect(mayClaimEmpty(outcome)).toBe(false);
    });

    it("treats a 200 carrying ok:false as a real failure", async () => {
      const outcome = await loadPanel("/api/x/", "items", respondWith(200, { ok: false, errors: ["boom"] }));
      expect(outcome.state).toBe("unavailable");
      expect(mayClaimEmpty(outcome)).toBe(false);
    });

    it("never lets any failure mode claim emptiness", async () => {
      const failures = [
        respondWith(401, {}), respondWith(403, {}), respondWith(500, {}),
        respondWithInvalidJson(), respondWith(200, { ok: false }),
        (async () => { throw new Error("offline"); }) as unknown as () => Promise<Response>,
      ];
      for (const f of failures) {
        expect(mayClaimEmpty(await loadPanel("/api/x/", "items", f))).toBe(false);
      }
    });
  });

  describe("pickArray", () => {
    it("survives null, primitives and arrays at the top level", () => {
      expect(pickArray(null, "items")).toEqual([]);
      expect(pickArray("string", "items")).toEqual([]);
      expect(pickArray(42, "items")).toEqual([]);
      expect(pickArray({ items: [1, 2] }, "items")).toEqual([1, 2]);
    });
  });
});
