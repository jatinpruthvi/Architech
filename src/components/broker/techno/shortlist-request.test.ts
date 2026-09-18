import { describe, expect, it } from "vitest";
import { persistShortlist } from "./shortlist-request";

describe("persistShortlist", () => {
  it("accepts only confirmed API writes and uses the canonical route", async () => {
    let requestedUrl = "";
    const result = await persistShortlist("property-1", true, async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ ok: true, shortlisted: true }), { status: 200 });
    });

    expect(result).toEqual({ ok: true });
    expect(requestedUrl).toBe("/api/broker/technoproperty/shortlist/");
  });

  it("rejects HTTP and payload failures so optimistic UI can roll back", async () => {
    const result = await persistShortlist("property-1", true, async () =>
      new Response(JSON.stringify({ ok: false }), { status: 503 }),
    );

    expect(result).toEqual({ ok: false, error: "Could not update shortlist. Please try again." });
  });

  it("reports network failures", async () => {
    const result = await persistShortlist("property-1", false, async () => {
      throw new Error("offline");
    });

    expect(result).toEqual({ ok: false, error: "Could not update shortlist. Check your connection." });
  });
});
