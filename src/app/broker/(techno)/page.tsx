import Link from "next/link";
import { CountCard } from "@/components/broker/techno/CountCard";
import {
  UpdatesBlock,
  CategoryMiniGrid,
  CallingQueue,
} from "@/components/broker/techno/DashboardBlocks";
import { requireTechnoSession } from "@/lib/technoproperty/session";
import {
  getDashboardKpis,
  getCallingQueue,
} from "@/lib/technoproperty/repository";
import {
  Home,
  Building2,
  LayoutGrid,
  Plus,
  Minus,
  UsersRound,
  Calendar,
  Phone,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TechnoHome() {
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const kpis = await getDashboardKpis(orgId);
  const queue = await getCallingQueue(orgId, userId, 5);

  return (
    <div className="space-y-10">
      {/* Section 1: Owner Properties Data */}
      <section>
        <h2 className="tp-section-title">
          <LayoutGrid size={20} /> Owner Properties Data
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <CountCard
            big
            icon={Home}
            tone="blue"
            value={kpis.owner.active}
            label="Active Owner Properties"
            subtitle="Ready inventory"
          />
          <CountCard
            icon={Plus}
            tone="green"
            value={kpis.owner.today}
            label="Added Today"
            subtitle="Fresh owner entries"
          />
          <CountCard
            icon={Minus}
            tone="amber"
            value={kpis.owner.yesterday}
            label="Added Yesterday"
            subtitle="Previous day flow"
          />
        </div>

        <h3 className="tp-section-title mt-8 text-lg">Properties Status</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.byCategory.map((c) => (
            <Link key={c.key} href={`/broker/owners/${c.key}`}>
              <CountCard
                icon={c.key.includes("Rent") ? Home : Building2}
                tone={toneForCat(c.key)}
                value={c.active}
                label={labelForCat(c.key)}
                subtitle="Active"
              />
            </Link>
          ))}
          <CountCard
            icon={LayoutGrid}
            tone="slate"
            value={kpis.owner.active}
            label="Total Properties"
            subtitle="Active"
          />
        </div>

        <h3 className="tp-section-title mt-8 text-lg">Owner Properties Updates</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <UpdatesBlock title="Today's Properties" rows={kpis.today} />
          <UpdatesBlock title="Yesterday's Properties" rows={kpis.yesterday} />
        </div>
      </section>

      {/* Section 2: Broker Properties & Requirements */}
      <section>
        <h2 className="tp-section-title">
          <UsersRound size={20} /> Broker Properties &amp; Requirements Data{" "}
          <span className="live">Live broker counts</span>
        </h2>

        <div className="mt-4 tp-card">
          <p className="tp-chip tp-chip-blue">Properties</p>
          <h3 className="mt-2 font-display text-lg font-bold text-[var(--tp-ink)]">
            Property Counts
          </h3>
          <p className="tp-kpi-sub mt-1">Live broker property counts</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <CountCard icon={Plus} tone="green" value={kpis.broker.today} label="Today's Properties" subtitle="Fresh" />
            <CountCard icon={Calendar} tone="amber" value={kpis.broker.last15} label="Last 15 Days' Properties" subtitle="Recent flow" />
            <CountCard icon={LayoutGrid} tone="slate" value={kpis.broker.total} label="Total Properties" subtitle="All active" />
          </div>
          <CategoryMiniGrid rows={kpis.broker.byCategory} />
        </div>

        <div className="mt-4 tp-card">
          <p className="tp-chip tp-chip-green">Requirements</p>
          <h3 className="mt-2 font-display text-lg font-bold text-[var(--tp-ink)]">
            Requirement Counts
          </h3>
          <p className="tp-kpi-sub mt-1">Live broker requirement counts</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <CountCard icon={Plus} tone="green" value={kpis.requirements.today} label="Today's Requirements" subtitle="Fresh" />
            <CountCard icon={Calendar} tone="amber" value={kpis.requirements.last15} label="Last 15 Days' Requirements" subtitle="Recent flow" />
            <CountCard icon={LayoutGrid} tone="slate" value={kpis.requirements.total} label="Total Requirements" subtitle="All active" />
          </div>
          <CategoryMiniGrid rows={kpis.requirements.byCategory} />
          <p className="mt-3 text-xs text-[var(--tp-muted)]">
            Requirements will populate from the broker-properties crawler (brokersproperty.php) once it's wired.
          </p>
        </div>
      </section>

      {/* Section 3: Improved — Today's calling queue */}
      <section className="tp-card tp-card-accent" style={{ borderColor: "rgba(31,191,142,.35)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="tp-section-title !mb-1">
              <Phone size={20} className="text-[var(--tp-accent-2)]" /> Today&apos;s calling queue
              <span className="ml-2 tp-chip tp-chip-green">{queue.length} to call</span>
            </h2>
            <p className="mt-1 text-sm text-[var(--tp-muted)]">
              Newest owner listings you haven&apos;t called yet. Click to reveal the phone and dial instantly. Use the follow-up chips after each call so nothing slips through.
            </p>
          </div>
          <Link href="/broker/call-queue" className="tp-btn tp-btn-primary shrink-0">
            <TrendingUp size={14} /> Open power dialer
          </Link>
        </div>
        <CallingQueue orgId={orgId} userId={userId} rows={queue} />
      </section>
    </div>
  );
}

function labelForCat(key: string): string {
  return key === "ResidentialRent" ? "Residential Rent"
    : key === "ResidentialSell" ? "Residential Sell"
    : key === "CommercialRent" ? "Commercial Rent"
    : key === "CommercialSell" ? "Commercial Sell"
    : key;
}
function toneForCat(key: string): "blue" | "amber" | "rose" | "violet" {
  return key === "ResidentialRent" ? "blue"
    : key === "ResidentialSell" ? "amber"
    : key === "CommercialRent" ? "rose"
    : "violet";
}
