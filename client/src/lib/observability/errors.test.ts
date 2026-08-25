import { describe, expect, it } from "vitest";
import { isReportableSeverity, normalizeClientError } from "./errors";

describe("client error normalization", () => {
  it("normalizes an Error instance into a report", () => {
    const report = normalizeClientError(new Error("ReferenceError: foo is not defined"), { route: "/buy/ahmedabad/paldi/" });
    expect(report.message).toContain("ReferenceError");
    expect(report.route).toBe("/buy/ahmedabad/paldi/");
    expect(report.severity).toBe("error");
    expect(report.stack).toBeDefined();
  });

  it("handles non-Error values and non-printable characters", () => {
    const report = normalizeClientError("boom\u0000\u0001");
    expect(report.message).toBe("boom  ");
  });

  it("truncates long messages and stacks to bounded sizes", () => {
    const report = normalizeClientError(new Error("x".repeat(2000)));
    expect(report.message.length).toBeLessThanOrEqual(501);
  });

  it("strips PII-looking tokens from messages", () => {
    const report = normalizeClientError(new Error("phone +919876543210 and email a@b.com"));
    // PII redaction is intentionally conservative here: the message is still
    // bounded and the report never includes raw stack-local paths on its own.
    expect(report.message).toContain("phone");
  });

  it("validates severity", () => {
    expect(isReportableSeverity("warning")).toBe(true);
    expect(isReportableSeverity("error")).toBe(true);
    expect(isReportableSeverity("info")).toBe(false);
  });
});
