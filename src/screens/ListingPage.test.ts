import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/screens/ListingPage.tsx", "utf8");

describe("public lead WhatsApp opt-in contract", () => {
  it("keeps the opt-in optional and unchecked by default", () => {
    expect(source).toContain('name="whatsappOptIn"');
    expect(source).toContain('name="whatsappOptIn" type="checkbox"');
    expect(source).not.toMatch(/name="whatsappOptIn"[^>]*defaultChecked/);
    expect(source).toContain("whatsappOptIn: form.get(\"whatsappOptIn\") === \"on\"");
  });

  it("sends the displayed bounded copy, not a browser timestamp", () => {
    expect(source).toContain("const whatsappOptInText = t.listing.whatsappOptInText");
    expect(source).toContain("whatsappOptInText,");
    expect(source).not.toContain("whatsappOptInAt");
  });

  it("reuses one retry idempotency key until the lead succeeds", () => {
    expect(source).toContain("useRef<string | null>(null)");
    expect(source).toContain("retryIdempotencyKey.current ??=");
    expect(source).toContain("retryIdempotencyKey.current = null");
  });
});
