import { NextResponse } from "next/server";
import { isValidPincode } from "@/lib/pincodes";
import { resolvePostalCodeForServer } from "@/lib/location/server/postal-resolution";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const postalCode = code.trim();
  if (!isValidPincode(postalCode)) {
    return NextResponse.json({ ok: false, errors: ["PIN must contain exactly six digits and cannot start with zero."] }, { status: 400 });
  }
  const resolution = await resolvePostalCodeForServer(postalCode);
  if (!resolution) {
    return NextResponse.json({ ok: false, postalCode, errors: ["No exact reviewed postal mapping is available."] }, { status: 404, headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  }
  return NextResponse.json(
    { ok: true, resolution, disclaimer: "A PIN can serve several localities and does not identify an exact address." },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
