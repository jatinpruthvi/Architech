import "server-only";
import { DemoReraProvider, GujaratReraProvider } from "@/lib/rera/provider";
import { getReraSourceMode, validateGujaratReraEnvironment } from "@/lib/rera/source";

export function getReraProvider(mode = getReraSourceMode()) {
  if (mode === "gujarat") {
    const env = validateGujaratReraEnvironment();
    if (!env.ok) throw new Error(`Gujarat RERA provider missing: ${env.missing.join(", ")}`);
    return new GujaratReraProvider();
  }
  return new DemoReraProvider();
}

export async function verifyReraRecordForServer(registrationNumber: string) {
  return getReraProvider().verify(registrationNumber);
}
