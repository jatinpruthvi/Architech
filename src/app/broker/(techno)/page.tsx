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
  type DashboardKpis,
  type PropertyRow,
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
  Search,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

/* This workspace reads the techno PostgreSQL. A demo/sandbox deployment may
   have no database behind it at all — and an uncaught Prisma error here kills
   the streamed page MID-FLIGHT: the 200 shell has already flushed, so the
   browser gets a broken client render (that was the "dashboard won't load"
   bug). The layout already degrades its counters with `.catch(() => 0)`; the
   dashboard body now does the same and says so honestly with a banner. A real
   deployment with a reachable database never takes the fallback path. */
const EMPTY_KPIS: DashboardKpis = {
  owner: { active: 0, today: 0, yesterday: 0 },
  byCategory: [],
  today: [],
  yesterday: [],
  broker: { today: 0, last15: 0, total: 0, byCategory: [] },
  requirements: { today: 0, last15: 0, total: 0, byCategory: [] },
  freshUnrevealed: 0,
};

let loggedDbUnavailable = false;

async function fetchOrEmpty<T>(label: string, fetcher: () => Promise<T>, fallback: T): Promise<{ value: T; degraded: boolean }> {
  try {
    return { value: await fetcher(), degraded: false };
  } catch (error) {
    if (!loggedDbUnavailable) {
      console.error(`[broker] ${label} unavailable — rendering empty demo data`, error);
      loggedDbUnavailable = true;
    }
    return { value: fallback, degraded: true };
  }
}

export default async function TechnoHome() {
  const session = await requireTechnoSession();
  const orgId = session.organization!.id;
  const userId = session.user.id;
  const [{ value: kpis, degraded: kpisDegraded }, { value: queue, degraded: queueDegraded }] = await Promise.all([
    fetchOrEmpty("dashboard KPIs", () => getDashboardKpis(orgId), EMPTY_KPIS),
    fetchOrEmpty("calling queue", () => getCallingQueue(orgId, userId, 5).then((r) => r.rows), [] as PropertyRow[]),
  ]);
  const dataDegraded = kpisDegraded || queueDegraded;

  return (
    <div className="space-y-7 md:space-y-10">
      {dataDegraded && (
        <p role="status" className="tp-chip tp-chip-amber w-fit">
          Demo preview: the listing database is not connected, so counters show zeros.
        </p>
      )}
      <h1 className="sr-only">Broker dashboard</h1>
      <section className="tp-mobile-priority md:hidden" aria-label="Today at a glance">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--tp-accent)]">Today at a glance</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-bold text-[var(--tp-ink)]">{queue.filter((row) => row.callState === "new" || row.callState === "retry" || row.callState === "followup").length}</p>
            <p className="text-sm text-[var(--tp-muted)]">fresh owners ready to call</p>
          </div>
          <span className="tp-chip tp-chip-green"><Zap size={13} /> {kpis.owner.today} new listings</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/broker/call-queue" className="tp-btn tp-btn-primary min-h-11 justify-center"><Phone size={16} /> Start calling</Link>
          <Link href="/broker/search" className="tp-btn tp-btn-ghost min-h-11 justify-center"><Search size={16} /> Search</Link>
        </div>
      </section>

      {/* Section 1: Owner Properties Data */}
      <section>
        <h2 className="tp-section-title">
          <LayoutGrid size={20} /> Owner Properties Data
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
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
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
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
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="tp-section-title !mb-1">
              <Phone size={20} className="text-[var(--tp-accent-2)]" /> Today&apos;s calling queue
              <span className="ml-2 tp-chip tp-chip-green">{queue.filter((row) => row.callState === "new" || row.callState === "retry" || row.callState === "followup").length} to call</span>
            </h2>
            <p className="mt-1 text-sm text-[var(--tp-muted)]">
              Newest owner listings first. Tap the ready phone number to dial, then log an outcome so no follow-up slips through.
            </p>
          </div>
          <Link href="/broker/call-queue" className="tp-btn tp-btn-primary min-h-11 shrink-0 justify-center">
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
