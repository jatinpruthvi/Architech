import { describe, expect, it } from "vitest";
import { fromWhatsAppJid, maskE164, normalizeIndianPhone, telLink, toE164OrThrow, toWhatsAppJid, waMeLink } from "./phone";

const e164 = (raw: string) => {
  const result = normalizeIndianPhone(raw);
  return result.ok ? result.e164 : `ERROR: ${result.reason}`;
};

describe("Indian phone normalisation for cross-system identity", () => {
  it("collapses every common input shape to one canonical string", () => {
    /* This is the whole point: ERPNext's contact_exists() does an exact string
       match, so all of these must produce a single value or the same human
       becomes several Customer records. */
    const shapes = [
      "9876543210",
      "+919876543210",
      "+91 98765 43210",
      "+91-98765-43210",
      "09876543210",
      "0 98765 43210",
      "091-9876543210",
      "  +91 (98765) 43210  ",
      "98765 43210",
    ];
    const normalized = new Set(shapes.map(e164));
    expect(normalized).toEqual(new Set(["+919876543210"]));
  });

  it("exposes national form and last4 for masking without re-parsing", () => {
    const result = normalizeIndianPhone("+91 98765 43210");
    expect(result.ok && result.national).toBe("9876543210");
    expect(result.ok && result.last4).toBe("3210");
  });

  it("rejects numbers that are not reachable Indian mobiles", () => {
    // Landline/service prefixes cannot receive WhatsApp or SMS.
    expect(e164("1234567890")).toMatch(/start with 6, 7, 8 or 9/);
    expect(e164("5876543210")).toMatch(/start with 6, 7, 8 or 9/);
  });

  it("rejects wrong-length input with a specific reason", () => {
    expect(e164("98765")).toMatch(/received 5 digits/);
    expect(e164("98765432101234")).toMatch(/received 14 digits/);
  });

  it("rejects empty and missing input", () => {
    expect(e164("")).toMatch(/required/);
    expect(normalizeIndianPhone(null).ok).toBe(false);
    expect(normalizeIndianPhone(undefined).ok).toBe(false);
  });

  it("strips trunk prefix and country code together without losing a digit", () => {
    // "0" + "91" + 10 digits = 13. Order-of-stripping regression guard.
    expect(e164("0919876543210")).toBe("+919876543210");
  });

  it("throws with the field name on the write path", () => {
    expect(() => toE164OrThrow("123", "businessPhone")).toThrow(/businessPhone/);
    expect(toE164OrThrow("9876543210")).toBe("+919876543210");
  });

  it("builds a wa.me link with digits only", () => {
    // A '+' here produces a link that silently fails to open a chat.
    expect(waMeLink("+919876543210")).toBe("https://wa.me/919876543210");
    expect(waMeLink("+919876543210")).not.toContain("+");
  });

  it("builds a tel: link that keeps the plus for the dialer", () => {
    expect(telLink("+919876543210")).toBe("tel:+919876543210");
  });

  it("masks for display without exposing the subscriber digits", () => {
    const masked = maskE164("+919876543210");
    expect(masked).toContain("3210");
    expect(masked).not.toContain("98765");
  });
});

describe("WhatsApp JID for Evolution API", () => {
  it("builds the digits-only JID Evolution's createJid produces", () => {
    expect(toWhatsAppJid("+919876543210")).toBe("919876543210@s.whatsapp.net");
  });

  it("never leaves a '+' in the JID", () => {
    // Evolution strips '+' on its own input path; ours must match byte for byte
    // or the (remoteJid, instanceId) unique key will not line up.
    expect(toWhatsAppJid("+919876543210")).not.toContain("+");
  });

  it("round-trips back to E.164", () => {
    const back = fromWhatsAppJid("919876543210@s.whatsapp.net");
    expect(back.ok && back.e164).toBe("+919876543210");
  });

  it("strips the Baileys device suffix on inbound events", () => {
    const back = fromWhatsAppJid("919876543210:12@s.whatsapp.net");
    expect(back.ok && back.e164).toBe("+919876543210");
  });

  it("rejects an empty number rather than emitting a bare suffix", () => {
    expect(() => toWhatsAppJid("")).toThrow();
  });

  it("keeps JID and E.164 as distinct formats", () => {
    const e164 = "+919876543210";
    expect(toWhatsAppJid(e164)).not.toBe(e164);
  });
});
