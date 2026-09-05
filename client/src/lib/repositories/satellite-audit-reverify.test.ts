import { describe, expect, it } from "vitest";
import { getLocalityBySlug, getLocalityStaticParams } from "@/lib/repositories";

/* Audit re-verification: the SEO audit reported /buy/ahmedabad/satellite/ as
   a 404. The route is app/buy/[city]/[locality]/page.tsx where `buy` is a
   LITERAL segment and the static params come from getLocalityStaticParams().
   Verify both halves resolve so the finding can be retired as stale. */
describe("satellite 404 audit re-verify", () => {
  it("generateStaticParams covers ahmedabad/satellite and the resolver finds the locality", () => {
    expect(getLocalityStaticParams()).toContainEqual({ city: "ahmedabad", locality: "satellite" });
    expect(getLocalityBySlug("satellite", "ahmedabad")?.name).toBe("Satellite");
  });
});
