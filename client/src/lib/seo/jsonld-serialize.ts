/* Safe serialization for embedded JSON-LD.

   Every `<script type="application/ld+json">` on the site embeds its payload
   with this helper instead of a bare `JSON.stringify`. `JSON.stringify` does
   not escape `<` or `/`, so any data value containing `</script>` — a broker
   draft title is the realistic case once the Prisma source is live — would
   terminate the script tag early and execute as page-level script: a stored
   XSS one review away from production. Escaping `<` (plus the JS line
   separators, which are legal JSON but not safe in script contexts) keeps the
   payload byte-equivalent JSON while making early termination impossible. */

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
