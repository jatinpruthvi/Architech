import { describe, expect, it } from "vitest";
import {
  ACKNOWLEDGEMENT_PREVIEW_VALUES,
  DEFAULT_ACKNOWLEDGEMENT_BODY,
  WhatsAppTemplateError,
  renderAcknowledgementTemplate,
  validateAcknowledgementTemplate,
} from "./template";

const values = { ...ACKNOWLEDGEMENT_PREVIEW_VALUES };

describe("WhatsApp acknowledgement templates", () => {
  it("accepts only the four named placeholders and returns stable names", () => {
    expect(validateAcknowledgementTemplate("Hi {{firstName}} from {{brokerName}}.")).toMatchObject({ ok: true, placeholders: ["brokerName", "firstName"] });
    expect(validateAcknowledgementTemplate(DEFAULT_ACKNOWLEDGEMENT_BODY)).toMatchObject({ ok: true });
  });

  it("rejects contact-data placeholders, oversized bodies, controls, and empty copy", () => {
    expect(validateAcknowledgementTemplate("Hi {{phone}}.")).toMatchObject({ ok: false });
    expect(validateAcknowledgementTemplate("{{firstName}}".repeat(1000))).toMatchObject({ ok: false });
    expect(validateAcknowledgementTemplate("hello\u0000there")).toMatchObject({ ok: false });
    expect(validateAcknowledgementTemplate(" \n\t ")).toMatchObject({ ok: false });
    expect(validateAcknowledgementTemplate("Hello {{firstName}}")).toMatchObject({ ok: true });
  });

  it("normalizes line endings and renders without evaluating arbitrary expressions", () => {
    expect(validateAcknowledgementTemplate("  Hello\r\n{{firstName}}  ")).toMatchObject({ ok: true, body: "Hello\n{{firstName}}" });
    expect(renderAcknowledgementTemplate("Hi {{firstName}}", { ...values, firstName: "Asha" })).toBe("Hi Asha");
    expect(renderAcknowledgementTemplate("Use {literal} {{firstName}}", values)).toBe("Use {literal} Asha");
  });

  it("strips replacement controls and rejects oversized replacement values", () => {
    expect(renderAcknowledgementTemplate("Hi {{firstName}}", { ...values, firstName: "Asha\nKhan" })).toBe("Hi Asha Khan");
    expect(() => renderAcknowledgementTemplate("Hi {{firstName}}", { ...values, firstName: "x".repeat(241) })).toThrow(WhatsAppTemplateError);
    expect(() => renderAcknowledgementTemplate("Hi {{firstName}}", { ...values, firstName: "x".repeat(240), brokerName: "x".repeat(240), listingTitle: "x".repeat(240), city: "x".repeat(240) })).not.toThrow();
  });
});
