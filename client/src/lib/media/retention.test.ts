import { describe, expect, it } from "vitest";
import { decideMediaRetention, isExifCleared, isPublishable } from "./retention";

describe("media retention, takedown & EXIF policy", () => {
  it("auto-removes pending media after the retention window", () => {
    const decision = decideMediaRetention("PENDING", 31);
    expect(decision.act).toBe("takedown");
    expect(decision.reason).toContain("retention");
  });

  it("confirms a takedown after the holding period", () => {
    const decision = decideMediaRetention("TAKEDOWN_REQUESTED", 7);
    expect(decision.act).toBe("delete");
  });

  it("retains approved media while the listing is live", () => {
    const decision = decideMediaRetention("APPROVED", 400);
    expect(decision.act).toBe("retain");
  });

  it("rejects publication if media is not approved or EXIF is not stripped", () => {
    expect(isPublishable({ moderationStatus: "PENDING", exifStripped: true }).ok).toBe(false);
    expect(isPublishable({ moderationStatus: "APPROVED", exifStripped: false }).reasons).toContain("Location/EXIF metadata must be stripped before publication.");
    expect(isPublishable({ moderationStatus: "APPROVED", exifStripped: true }).ok).toBe(true);
  });

  it("flags EXIF status correctly", () => {
    expect(isExifCleared(true)).toBe(true);
    expect(isExifCleared(false)).toBe(false);
  });

  it("retains by default for states with no policy or within the window", () => {
    expect(decideMediaRetention("PENDING", 5).act).toBe("retain");
  });
});
