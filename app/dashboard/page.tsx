/* Compatibility alias for the historical dashboard URL. Keeping this redirect
   server-side prevents the stale `/dashboard/` path from rendering the animated
   not-found client tree before navigation to the protected broker workspace. */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardAliasPage() {
  redirect("/broker/dashboard/");
}
