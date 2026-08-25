"use client";
import Link from "next/link";
import { ArrowUpRight, Building2, Inbox, ShieldCheck, UserRoundCog } from "lucide-react";
import { demoBrokerSession } from "@/lib/auth/roles";
import useTitle from "@/hooks/useTitle";

const cards = [
  { icon: Building2, title: "Organization profile", body: "Nivasa Partners is represented as a verified broker organization in the Phase 1 schema.", action: "Review profile" },
  { icon: Inbox, title: "Lead inbox", body: "Enquiries land here with masked contact, consent on file, and every status change audited.", action: "Open leads", href: "/broker/leads" },
  { icon: UserRoundCog, title: "Roles and permissions", body: "Broker admin/member role checks are centralized before Better Auth is fully connected.", action: "View roles" },
];

export default function BrokerDashboard() {
  useTitle("Broker dashboard");
  const session = demoBrokerSession;

  return (
    <div className="bg-paper pt-[78px] text-ink">
      <section className="border-b border-ink/12 bg-sand/70 py-14 md:py-20">
        <div className="container">
          <p className="kicker text-brick">Broker operations · Better Auth contract</p>
          <h1 className="display mt-6 max-w-[780px] text-[clamp(40px,6vw,84px)]">A protected workspace for <em className="text-brick">verified partners</em>.</h1>
          <p className="mt-6 max-w-[560px] text-base leading-8 text-ink/65">This is the Phase 1 authenticated shell: roles, organization context, and permissions are in place before live sessions are enabled.</p>
        </div>
      </section>

      <section className="container py-14 md:py-20">
        <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="h-fit border border-ink/12 bg-card p-7">
            <span className="grid h-14 w-14 place-items-center rounded-t-full bg-trust/10 text-trust"><ShieldCheck size={24} /></span>
            <p className="mt-5 font-display text-2xl font-medium tracking-[-0.02em]">{session.organization?.name}</p>
            <p className="stamp mt-2 !text-[10px] text-trust">{session.organization?.verificationStatus.replaceAll("_", " ")}</p>
            <dl className="mt-7 space-y-4 border-t border-ink/10 pt-5 text-sm">
              <div><dt className="stamp !text-[10px] text-ink/55">Signed in as</dt><dd className="mt-1 font-medium">{session.user.name}</dd></div>
              <div><dt className="stamp !text-[10px] text-ink/55">Role</dt><dd className="mt-1 font-medium">{session.user.role.replaceAll("_", " ")}</dd></div>
              <div><dt className="stamp !text-[10px] text-ink/55">Session source</dt><dd className="mt-1 font-medium">{session.source}</dd></div>
            </dl>
          </aside>

          <div className="grid gap-5 md:grid-cols-3">
            {cards.map(({ icon: Icon, title, body, action, href }) => (
              <article key={title} className="border border-ink/12 bg-card p-6 motion-lift hover:editorial-shadow">
                <Icon size={20} className="text-brick" />
                <h2 className="mt-5 font-display text-2xl font-medium tracking-[-0.02em]">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-ink/60">{body}</p>
                {href ? (
                  <Link href={href} className="group mt-6 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-brick">{action} <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
                ) : (
                  <p className="mt-6 inline-flex items-center gap-1.5 stamp !text-[11px] font-semibold text-brick">{action} <ArrowUpRight size={13} /></p>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="mt-12 border border-dashed border-ink/20 bg-sand/50 p-7">
          <p className="stamp !text-[10px] text-ink/60">Activation gate</p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/65">Live Better Auth sessions, secure cookies, passkeys/2FA, and database-backed organization memberships remain behind the production auth gate. This shell locks the route and permission contract first.</p>
          <Link href="/guide" className="mt-5 inline-flex items-center gap-2 stamp !text-[12px] font-semibold text-brick">Read verification method <ArrowUpRight size={14} /></Link>
        </div>
      </section>
    </div>
  );
}
