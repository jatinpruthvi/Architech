import "server-only";
import { liveCities } from "@/lib/cities";
import { DemoReraProvider, GujaratReraProvider, UnsupportedReraProvider, type ReraJurisdiction } from "@/lib/rera/provider";
import { getReraSourceMode, validateGujaratReraEnvironment } from "@/lib/rera/source";

function unsupportedJurisdiction(stateSlug: string): ReraJurisdiction {
  const city = liveCities.find((candidate) => candidate.stateSlug === stateSlug);
  return {
    stateSlug,
    stateName: city?.state ?? stateSlug,
    authorityName: city ? `${city.state} Real Estate Regulatory Authority` : "Applicable Real Estate Regulatory Authority",
    publicRegistryUrl: null,
  };
}

/** Resolve by the property's state/UT before touching a provider. Only Gujarat
 * has an adapter today; unsupported states return an explicit unavailable
 * provider rather than inheriting Gujarat behavior. */
export function getReraProvider(stateSlug: string, mode = getReraSourceMode()) {
  if (stateSlug !== "gujarat") return new UnsupportedReraProvider(unsupportedJurisdiction(stateSlug));
  if (mode === "gujarat") {
    const env = validateGujaratReraEnvironment();
    if (!env.ok) throw new Error(`Gujarat RERA provider missing: ${env.missing.join(", ")}`);
    return new GujaratReraProvider();
  }
  return new DemoReraProvider();
}

export async function verifyReraRecordForServer(stateSlug: string, registrationNumber: string) {
  return getReraProvider(stateSlug).verify(registrationNumber);
}
