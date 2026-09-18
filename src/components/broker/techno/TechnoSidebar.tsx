"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/contexts/SessionContext";
import { normalizeTechnoPathname } from "@/lib/technoproperty/routes";
import {
  Bell,
  Bookmark,
  ChevronDown,
  ClipboardList,
  Crown,
  ExternalLink,
  HelpCircle,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MoreHorizontal,
  Phone,
  Search,
  Settings as SettingsIcon,
  UsersRound,
} from "lucide-react";

type NavKey =
  | "dashboard"
  | "search"
  | "shortlisted"
  | "premium"
  | "activities"
  | "call-queue";

const main: { key: NavKey; label: string; icon: typeof Home; href: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/broker" },
  { key: "search", label: "Search", icon: Search, href: "/broker/search" },
];
const tail: { key: NavKey; label: string; icon: typeof Home; href: string }[] = [
  { key: "shortlisted", label: "Shortlisted", icon: Bookmark, href: "/broker/shortlisted" },
  { key: "premium", label: "Premium", icon: Crown, href: "/broker/premium" },
  { key: "activities", label: "My Activities", icon: ListChecks, href: "/broker/activities" },
  { key: "call-queue", label: "Call queue", icon: Phone, href: "/broker/call-queue" },
];
const ownerCats = [
  { label: "Residential Rent", href: "/broker/owners/ResidentialRent" },
  { label: "Residential Sell", href: "/broker/owners/ResidentialSell" },
  { label: "Commercial Rent", href: "/broker/owners/CommercialRent" },
  { label: "Commercial Sell", href: "/broker/owners/CommercialSell" },
  { label: "All Properties", href: "/broker/owners" },
];
const brokerCats = [
  { label: "Residential Rent", href: "/broker/brokers/ResidentialRent" },
  { label: "Residential Sell", href: "/broker/brokers/ResidentialSell" },
  { label: "Commercial Rent", href: "/broker/brokers/CommercialRent" },
  { label: "Commercial Sell", href: "/broker/brokers/CommercialSell" },
  { label: "All Properties", href: "/broker/brokers" },
];
const requirementCats = [
  { label: "Residential Rent", href: "/broker/requirements/ResidentialRent" },
  { label: "Residential Sell", href: "/broker/requirements/ResidentialSell" },
  { label: "Commercial Rent", href: "/broker/requirements/CommercialRent" },
  { label: "Commercial Sell", href: "/broker/requirements/CommercialSell" },
  { label: "All Requirements", href: "/broker/requirements" },
];
const moreLinks = [
  { label: "Notifications", href: "/broker/activities#notifications", icon: Bell },
  { label: "Field notes", href: "/broker/activities#notes", icon: ClipboardList },
  { label: "How it works", href: "/guide", icon: HelpCircle },
  { label: "Settings", href: "/broker/agent", icon: SettingsIcon },
];

export function TechnoNavContent({
  freshCount = 0,
  shortlistCount = 0,
  onNavigate,
}: {
  freshCount?: number;
  shortlistCount?: number;
  onNavigate?: () => void;
}) {
  const pathname = normalizeTechnoPathname(usePathname() ?? "");
  const { signOut } = useSession();
  const [ownersOpen, setOwnersOpen] = useState(pathname.includes("/owners") || pathname === "/broker");
  const [brokersOpen, setBrokersOpen] = useState(pathname.includes("/brokers"));
  const [requirementsOpen, setRequirementsOpen] = useState(pathname.includes("/requirements"));
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/broker" ? pathname === "/broker" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-full flex-col">
      <div className="mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--tp-accent)] font-display text-lg font-bold text-[var(--cream)]">
            A
          </span>
          <div>
            <p className="font-display text-lg font-bold leading-tight text-[var(--tp-ink)]">
              Architech<span className="text-[var(--tp-accent)]">.</span>
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[var(--tp-muted)]">Partner workspace</p>
          </div>
        </div>
      </div>

      <nav className="space-y-0.5" aria-label="Broker workspace">
        {main.map(({ key, label, icon: Icon, href }) => (
          <Link key={key} href={href} className="tp-sidebar-item" aria-current={isActive(href) ? "page" : undefined} onClick={onNavigate}>
            <Icon size={18} /> <span>{label}</span>
          </Link>
        ))}

        <NavSection label="Owner Properties" icon={Home} open={ownersOpen} setOpen={setOwnersOpen} links={ownerCats} isActive={isActive} onNavigate={onNavigate} />
        <NavSection label="Broker Properties" icon={UsersRound} open={brokersOpen} setOpen={setBrokersOpen} links={brokerCats} isActive={isActive} onNavigate={onNavigate} />
        <NavSection label="Requirements" icon={ClipboardList} open={requirementsOpen} setOpen={setRequirementsOpen} links={requirementCats} isActive={isActive} onNavigate={onNavigate} />

        {tail.map(({ key, label, icon: Icon, href }) => {
          const isCallQueue = key === "call-queue";
          const count = isCallQueue ? freshCount : key === "shortlisted" ? shortlistCount : 0;
          return (
            <Link key={key} href={href} className="tp-sidebar-item" aria-current={isActive(href) ? "page" : undefined} onClick={onNavigate}>
              <Icon size={18} />
              <span>{label}</span>
              {count > 0 ? <CountBadge count={count} urgent={isCallQueue} /> : null}
            </Link>
          );
        })}

        <button type="button" className="tp-sidebar-item w-full justify-between" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen}>
          <span className="flex items-center gap-2"><MoreHorizontal size={18} /> More</span>
          <ChevronDown size={16} className={`transition-transform ${moreOpen ? "" : "-rotate-90"}`} />
        </button>
        {moreOpen ? (
          <div className="tp-submenu mb-1">
            {moreLinks.map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href} className="tp-sidebar-item" aria-current={isActive(href) ? "page" : undefined} onClick={onNavigate}>
                <Icon size={16} /> {label}
              </Link>
            ))}
            <button
              type="button"
              className="tp-sidebar-item w-full"
              onClick={() => {
                onNavigate?.();
                void signOut();
              }}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        ) : null}
      </nav>

      <div className="mt-auto pt-4">
        <Link href="/broker/agent" className="tp-sidebar-item text-[var(--tp-muted)]" title="Open the Architech partner desk" onClick={onNavigate}>
          <ExternalLink size={16} /> <span>Architech desk</span>
        </Link>
      </div>
    </div>
  );
}

function NavSection({
  label,
  icon: Icon,
  open,
  setOpen,
  links,
  isActive,
  onNavigate,
}: {
  label: string;
  icon: typeof Home;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  links: { label: string; href: string }[];
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <button type="button" className="tp-sidebar-item w-full justify-between" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="flex items-center gap-2"><Icon size={18} /> {label}</span>
        <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? (
        <div className="tp-submenu mb-1">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="tp-sidebar-item" aria-current={isActive(item.href) ? "page" : undefined} onClick={onNavigate}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function CountBadge({ count, urgent = false }: { count: number; urgent?: boolean }) {
  return (
    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${urgent ? "bg-[var(--tp-rose)]" : "bg-[var(--tp-accent-2)]"}`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function TechnoSidebar({ freshCount = 0, shortlistCount = 0 }: { freshCount?: number; shortlistCount?: number }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--tp-border)] bg-white md:block">
      <div className="sticky top-0 h-dvh overflow-y-auto p-4">
        <TechnoNavContent freshCount={freshCount} shortlistCount={shortlistCount} />
      </div>
    </aside>
  );
}
