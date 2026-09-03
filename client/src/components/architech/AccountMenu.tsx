"use client";
/* Header account control.
 *
 * Renders the one thing the header was missing: a visible, honest answer to
 * "am I signed in, and as what?", plus the way out. Role is shown because this
 * product has genuinely different surfaces per role — a broker seeing a buyer's
 * header would be a real confusion, not a cosmetic one.
 *
 * While the session is still loading it renders a neutral placeholder of the
 * same width rather than the signed-out state, so the header does not flicker
 * from "Sign in" to an account name on every page load.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogIn, LogOut, LayoutDashboard, ShieldCheck, UserRound } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { landingPathForSession, loginUrlFor } from "@/lib/auth/redirects";

const ROLE_LABEL: Record<string, string> = {
  BUYER: "Buyer",
  BROKER_MEMBER: "Broker member",
  BROKER_ADMIN: "Broker admin",
  MODERATOR: "Moderator",
  ADMIN: "Administrator",
};

export default function AccountMenu({ onDark = false }: { onDark?: boolean }) {
  const { status, session, canAccessBrokerDashboard, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* On the transparent hero the header sits on the night image, where the
     per-theme ink ramp does not apply — cream is the correct label there. */
  const linkClass = `stamp font-medium ${onDark ? "text-cream" : "ink-2"} link-rail`;

  if (status === "loading") {
    return <span className="hidden h-5 w-[72px] animate-pulse rounded bg-current/10 md:inline-block" aria-hidden="true" />;
  }

  if (!session) {
    return (
      <Link href={loginUrlFor(pathname)} className={`hidden items-center gap-2 md:inline-flex ${linkClass}`}>
        <LogIn size={14} strokeWidth={1.8} aria-hidden="true" /> Sign in
      </Link>
    );
  }

  const initials = session.user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "A";

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center gap-2 ${linkClass}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brick text-[11px] font-bold text-cream" aria-hidden="true">{initials}</span>
        <span className="max-w-[110px] truncate">{session.user.name}</span>
        <ChevronDown size={13} aria-hidden="true" className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 top-[calc(100%+12px)] z-50 w-[260px] border border-ink/15 bg-card p-4 text-ink shadow-xl">
          <p className="text-[14px] font-semibold">{session.user.name}</p>
          <p className="mt-0.5 truncate text-[12px] ink-3">{session.user.email}</p>
          <p className="stamp mt-2 font-semibold text-brick">{ROLE_LABEL[session.user.role] ?? session.user.role}</p>
          {session.organization && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-trust">
              <ShieldCheck size={13} aria-hidden="true" /> {session.organization.name}
            </p>
          )}

          <div className="mt-4 space-y-1 border-t border-ink/10 pt-3">
            <Link role="menuitem" href={landingPathForSession(session)} className="flex items-center gap-2 px-1 py-2 text-[13px] ink-2 hover:text-brick">
              <LayoutDashboard size={14} aria-hidden="true" /> {canAccessBrokerDashboard ? "Broker dashboard" : "Your shortlist"}
            </Link>
            <Link role="menuitem" href="/saved/" className="flex items-center gap-2 px-1 py-2 text-[13px] ink-2 hover:text-brick">
              <UserRound size={14} aria-hidden="true" /> Saved homes
            </Link>
            <button
              role="menuitem"
              type="button"
              onClick={async () => { setOpen(false); await signOut(); router.replace("/login/"); router.refresh(); }}
              className="flex w-full items-center gap-2 px-1 py-2 text-left text-[13px] text-brick hover:underline"
            >
              <LogOut size={14} aria-hidden="true" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
