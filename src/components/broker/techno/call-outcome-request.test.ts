import { describe, expect, it } from "vitest";
import { persistCallOutcome } from "./call-outcome-request";

describe("persistCallOutcome", () => {
  it("reports success only when both HTTP and payload confirm the write", async () => {
    let requestedUrl = "";
    const result = await persistCallOutcome("property-1", "connected", null, async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    expect(result).toEqual({ ok: true });
    expect(requestedUrl).toBe("/api/broker/technoproperty/call-outcome/");
  });

  it("turns a rejected API response into recoverable UI feedback", async () => {
    const result = await persistCallOutcome("property-1", "connected", null, async () =>
      new Response(JSON.stringify({ ok: false, error: "SAVE_FAILED" }), { status: 503 }),
    );
    expect(result).toEqual({ ok: false, error: "Could not save outcome. Please try again." });
  });

  it("turns a network failure into recoverable UI feedback", async () => {
    const result = await persistCallOutcome("property-1", "connected", null, async () => {
      throw new Error("offline");
    });
    expect(result).toEqual({ ok: false, error: "Could not save outcome. Check your connection." });
  });
});
