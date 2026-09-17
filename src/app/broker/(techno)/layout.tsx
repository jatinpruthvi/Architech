import { redirect } from "next/navigation";
import { TechnoSidebar } from "@/components/broker/techno/TechnoSidebar";
import { TechnoTopbar } from "@/components/broker/techno/TechnoTopbar";
import RequireSession from "@/components/architech/RequireSession";
import { getTechnoSession } from "@/lib/technoproperty/session";
import { countFreshUnrevealed, countShortlisted } from "@/lib/technoproperty/repository";
import WhatsAppFab from "@/components/broker/techno/WhatsAppFab";
import TechnoKeyboardShortcuts from "@/components/broker/techno/TechnoKeyboardShortcuts";

export const dynamic = "force-dynamic";

export default async function TechnoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireSession permission="broker.dashboard.read" requireOrganization>
      <TechnoShell>{children}</TechnoShell>
    </RequireSession>
  );
}

async function TechnoShell({ children }: { children: React.ReactNode }) {
  const session = await getTechnoSession();
  if (!session) redirect("/login");
  const firstName = (session.user.name || "Broker").split(" ")[0];
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const [freshCount, shortlistCount] = await Promise.all([
    countFreshUnrevealed(orgId, userId).catch(() => 0),
    countShortlisted(orgId, userId).catch(() => 0),
  ]);
  return (
    <div className="techno min-h-screen">
      <a
        href="#techno-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-[1400px]">
        <TechnoSidebar freshCount={freshCount} shortlistCount={shortlistCount} />
        <div className="min-w-0 flex-1">
          <TechnoTopbar userName={firstName} />
          <main id="techno-main" className="px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
      <WhatsAppFab />
      <TechnoKeyboardShortcuts />
    </div>
  );
}
