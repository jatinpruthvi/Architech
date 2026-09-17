import { requireTechnoSession } from "@/lib/technoproperty/session";
import { getActivities } from "@/lib/technoproperty/repository";
import { ActivityWidgets, PaymentStrip } from "@/components/broker/techno/ActivityWidgets";
import { ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const data = await getActivities(orgId, userId);
  return (
    <div className="space-y-6">
      <h1 className="tp-section-title text-2xl">
        <ListChecks size={22} /> My Activities
      </h1>
      <PaymentStrip />
      <ActivityWidgets data={data} />
    </div>
  );
}
