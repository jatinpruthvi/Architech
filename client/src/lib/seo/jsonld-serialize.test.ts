import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "./jsonld-serialize";

describe("serializeJsonLd", () => {
  it("produces byte-equivalent JSON for ordinary structured data", () => {
    const payload = { "@context": "https://schema.org", name: "A garden courtyard in Paldi", offer: { price: "₹1.85 Cr" } };
    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it("escapes </script> so a data value cannot terminate the embedding tag", () => {
    const hostile = { name: '</script><script>alert(1)</script>' };
    const serialized = serializeJsonLd(hostile);
    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized)).toEqual(hostile);
  });

  it("escapes the JS line separators that are legal JSON but unsafe in script context", () => {
    const serialized = serializeJsonLd({ name: "line\u2028sep\u2029end" });
    // JSON.stringify itself emits the \u2028 escape; assert the RAW characters
    // never survive and the escaped form is what lands in the script body.
    expect(serialized).not.toContain("\u2028");
    expect(serialized).not.toContain("\u2029");
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
  });
});
