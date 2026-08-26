import { NextResponse, type NextRequest } from "next/server";

/**
 * Public pages remain crawlable only after the production data and legal gates
 * are explicitly enabled. This protects against accidentally publishing demo
 * listing counts, RERA fixtures, or unreviewed guides into a sitemap.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const indexingEnabled = process.env.PUBLIC_INDEXING_ENABLED === "true";
  if (process.env.NODE_ENV === "production" && !indexingEnabled) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.svg|icon-.*\\.png|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|api/).*)"],
};
