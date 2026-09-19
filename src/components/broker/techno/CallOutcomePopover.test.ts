import { describe, expect, it } from "vitest";
import { buildFollowUpIso, followUpBounds } from "./CallOutcomePopover";

const localYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("buildFollowUpIso", () => {
  it("builds a local-time ISO datetime from date + time", () => {
    const iso = buildFollowUpIso("2026-09-21", "17:30");
    expect(iso).not.toBeNull();
    const dt = new Date(iso as string);
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(8);
    expect(dt.getDate()).toBe(21);
    expect(dt.getHours()).toBe(17);
    expect(dt.getMinutes()).toBe(30);
  });

  it("defaults the time to 09:30 when only a date is given", () => {
    const dt = new Date(buildFollowUpIso("2026-09-21") as string);
    expect(dt.getHours()).toBe(9);
    expect(dt.getMinutes()).toBe(30);
  });

  it("accepts single-digit hours", () => {
    const dt = new Date(buildFollowUpIso("2026-09-21", "5:05") as string);
    expect(dt.getHours()).toBe(5);
    expect(dt.getMinutes()).toBe(5);
  });

  it("rejects malformed dates, times and impossible values", () => {
    expect(buildFollowUpIso("")).toBeNull();
    expect(buildFollowUpIso("21/09/2026")).toBeNull();
    expect(buildFollowUpIso("2026-13-01")).toBeNull();
    expect(buildFollowUpIso("2026-02-30")).toBeNull();
    expect(buildFollowUpIso("2026-09-21", "24:00")).toBeNull();
    expect(buildFollowUpIso("2026-09-21", "12:60")).toBeNull();
    expect(buildFollowUpIso("2026-09-21", "someday")).toBeNull();
  });
});

describe("followUpBounds", () => {
  it("starts tomorrow and runs 90 days out", () => {
    const { min, max } = followUpBounds();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const limit = new Date();
    limit.setDate(limit.getDate() + 90);
    expect(min).toBe(localYmd(tomorrow));
    expect(max).toBe(localYmd(limit));
    expect(min < max).toBe(true);
  });

  it("lets the quick-chip dates always fall inside the bounds", () => {
    const { min, max } = followUpBounds();
    for (const offset of [1, 2, 7]) {
      const d = new Date(Date.now() + offset * 86_400_000);
      const ymd = localYmd(d);
      expect(ymd >= min && ymd <= max).toBe(true);
    }
  });
});
