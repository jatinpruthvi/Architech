"use client";
/* Client gate for protected surfaces.
 *
 * IMPORTANT — this is a *navigation* guard, not an authorisation boundary.
 * It stops a signed-out visitor staring at an empty broker dashboard and sends
 * them to `/login/?next=…` so they return to where they were headed. It must
 * never be the only thing standing between a request and protected data: every
 * broker/moderation API already calls `authorizeRequest()` on the server, and
 * that is what actually enforces access. A page whose data is fetched from a
 * guarded route stays safe even with JavaScript disabled or this component
 * removed.
 *
 * The wait on `status === "loading"` is deliberate: redirecting before the
 * session has resolved would bounce every authenticated user to the login page
 * on a cold load.
 */
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, LockKeyhole } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { loginUrlFor } from "@/lib/auth/redirects";
import { canAccessBrokerDashboard as brokerGate, hasRoleAtLeast, requirePermission, type AuthRole } from "@/lib/auth/roles";

type Props = {
  children: ReactNode;
  /** Minimum role required to view the surface. */
  minimumRole?: AuthRole;
  /** Permission the session must carry. */
  permission?: string;
  /** Require broker role AND an organization, matching the server-side gate. */
  requireOrganization?: boolean;
};

function Panel({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-t-full bg-sand text-brick" aria-hidden="true">{icon}</span>
        <h1 className="display mt-7 max-w-[520px] text-[clamp(28px,3.6vw,48px)]">{title}</h1>
        <p className="mt-4 max-w-[420px] text-[15px] leading-7 ink-2">{body}</p>
        {action}
      </section>
    </div>
  );
}

export default function RequireSession({ children, minimumRole, permission, requireOrganization }: Props) {
  const { status, session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const unauthenticated = status === "unauthenticated" || (status !== "loading" && !session);

  useEffect(() => {
    if (unauthenticated) router.replace(loginUrlFor(pathname));
  }, [unauthenticated, pathname, router]);

  if (status === "loading") {
    return (
      <div className="bg-paper pt-[78px] text-ink">
        <div className="container flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
          <Loader2 size={22} className="animate-spin text-brick" aria-hidden="true" />
          <span className="sr-only">Checking your session…</span>
        </div>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <Panel
        icon={<LockKeyhole size={24} />}
        title="Sign-in is unavailable"
        body="Authentication is not configured for this environment, so protected surfaces cannot be opened. This is a deployment configuration issue, not a problem with your account."
      />
    );
  }

  if (!session) {
    return (
      <Panel
        icon={<LockKeyhole size={24} />}
        title="Sign in to continue"
        body="This is a protected workspace. Sign in and we will bring you straight back here."
        action={<Link href={loginUrlFor(pathname)} className="clay-fill btn-sweep motion-press mt-9 inline-flex items-center gap-2 bg-brick px-8 py-4 stamp font-semibold text-cream">Sign in</Link>}
      />
    );
  }

  const roleOk = !minimumRole || hasRoleAtLeast(session.user.role, minimumRole);
  const permissionOk = !permission || requirePermission(session, permission);
  const organizationOk = !requireOrganization || brokerGate(session);

  if (!roleOk || !permissionOk || !organizationOk) {
    return (
      <Panel
        icon={<LockKeyhole size={24} />}
        title="You do not have access to this workspace"
        body="Your account is signed in but does not carry the role or partner membership this surface requires. If that looks wrong, partner onboarding is where access is granted."
        action={<Link href="/broker/onboarding/" className="clay-fill btn-sweep motion-press mt-9 inline-flex items-center gap-2 bg-brick px-8 py-4 stamp font-semibold text-cream">Partner onboarding</Link>}
      />
    );
  }

  return <>{children}</>;
}
