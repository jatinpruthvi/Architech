import { describe, expect, it } from "vitest";
import { behaviorForLifecycle, httpDecisionForListing, isIndexable, isPubliclyViewable, parseLifecycle } from "./lifecycle";

describe("listing lifecycle HTTP & indexability", () => {
  it("serves 200 and indexable only for ACTIVE listings", () => {
    expect(behaviorForLifecycle("ACTIVE")).toEqual({ status: 200, indexable: true });
    expect(isIndexable("ACTIVE")).toBe(true);
    expect(isIndexable("SOLD")).toBe(false);
  });

  it("serves 410 GONE for EXPIRED and REMOVED", () => {
    expect(behaviorForLifecycle("EXPIRED")).toEqual({ status: 410, indexable: false });
    expect(behaviorForLifecycle("REMOVED")).toEqual({ status: 410, indexable: false });
  });

  it("serves 404 for non-public and 301 redirect for DUPLICATE", () => {
    expect(behaviorForLifecycle("DRAFT").status).toBe(404);
    expect(behaviorForLifecycle("IN_REVIEW").status).toBe(404);
    expect(behaviorForLifecycle("ARCHIVED").status).toBe(404);
    const duplicate = behaviorForLifecycle("DUPLICATE");
    expect(duplicate.status).toBe(301);
    expect(duplicate.redirectTo).toBe("canonical");
  });

  it("treats unknown lifecycle states as 404", () => {
    expect(parseLifecycle("weird-state")).toBe("UNKNOWN");
    expect(behaviorForLifecycle("ACTIVE")).toBeDefined();
    expect(httpDecisionForListing("weird-state").status).toBe(404);
  });

  it("resolves a duplicate redirect to the canonical id when provided", () => {
    const decision = httpDecisionForListing("DUPLICATE", "garden-courtyard");
    expect(decision.status).toBe(301);
    expect("redirectTo" in decision && decision.redirectTo).toBe("garden-courtyard");
  });

  it("exposes publicly-viewable helper for SOLD context", () => {
    expect(isPubliclyViewable("SOLD")).toBe(true);
    expect(isPubliclyViewable("EXPIRED")).toBe(false);
  });

  it("defaults a listing with no lifecycle to ACTIVE (live inventory)", () => {
    expect(parseLifecycle(undefined)).toBe("ACTIVE");
    expect(httpDecisionForListing(undefined).status).toBe(200);
    expect(httpDecisionForListing(null).status).toBe(200);
  });
});
