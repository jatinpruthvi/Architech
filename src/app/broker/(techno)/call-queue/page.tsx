import { requireTechnoSession } from "@/lib/technoproperty/session";
import { getCallingQueue } from "@/lib/technoproperty/repository";
import { CallQueueList } from "@/components/broker/techno/CallQueueList";
import { Phone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CallQueuePage() {
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const rows = await getCallingQueue(orgId, userId, 50);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="tp-section-title !text-2xl">
          <Phone size={22} /> Today’s call queue
        </h1>
      </div>
      <p className="text-sm leading-6 text-[var(--tp-muted)]">
        Phone numbers are ready. Call the next owner and log an outcome—the queue keeps completed work out of your way.
      </p>
      <CallQueueList rows={rows} />
      <p className="hidden text-center text-xs text-[var(--tp-muted)] md:block">
        Tip: press <kbd className="rounded border px-1.5 py-0.5 text-[10px]">c</kbd> from anywhere in the dashboard to jump here.
      </p>
    </div>
  );
}
