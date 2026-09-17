"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Search,
  Home,
  UsersRound,
  Bookmark,
  Crown,
  ListChecks,
  HelpCircle,
  ChevronDown,
  Phone,
  ExternalLink,
  MoreHorizontal,
  Bell,
  Settings as SettingsIcon,
  LogOut,
  ClipboardList,
} from "lucide-react";

type NavKey =
  | "dashboard"
  | "search"
  | "owners"
  | "brokers"
  | "requirements"
  | "shortlisted"
  | "premium"
  | "activities"
  | "call-queue"
  | "more";

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
  { label: "Sign out", href: "/logout", icon: LogOut },
];

export function TechnoSidebar({ freshCount = 0, shortlistCount = 0 }: { freshCount?: number; shortlistCount?: number }) {
  const pathname = usePathname() ?? "";
  const [ownersOpen, setOwnersOpen] = useState(true);
  const [brokersOpen, setBrokersOpen] = useState(true);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/broker" ? pathname === "/broker" : pathname === href || pathname.startsWith(href + "/");
  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--tp-border)] bg-white md:block">
      <div className="sticky top-[78px] flex h-[calc(100dvh-78px)] flex-col overflow-y-auto p-4">
        <div className="mb-4 px-2">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--tp-accent)] font-display text-lg font-bold text-white">
              T
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-tight text-[var(--tp-ink)]">
                Techno Property
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--tp-muted)]">
                Ahmedabad &amp; Gandhinagar
              </p>
            </div>
          </div>
        </div>
        <nav className="space-y-0.5">
          {main.map(({ key, label, icon: Icon, href }) => (
            <Link
              key={key}
              href={href}
              className="tp-sidebar-item"
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon size={17} /> <span>{label}</span>
            </Link>
          ))}

          <button
            type="button"
            className="tp-sidebar-item w-full justify-between"
            onClick={() => setOwnersOpen((v) => !v)}
            aria-expanded={ownersOpen}
          >
            <span className="flex items-center gap-2">
              <Home size={17} /> Owner Properties
            </span>
            <ChevronDown
              size={15}
              className={`transition-transform ${ownersOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {ownersOpen ? (
            <div className="tp-submenu mb-1">
              {ownerCats.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="tp-sidebar-item"
                  aria-current={isActive(c.href) ? "page" : undefined}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="tp-sidebar-item w-full justify-between"
            onClick={() => setBrokersOpen((v) => !v)}
            aria-expanded={brokersOpen}
          >
            <span className="flex items-center gap-2">
              <UsersRound size={17} /> Broker Properties
            </span>
            <ChevronDown
              size={15}
              className={`transition-transform ${brokersOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {brokersOpen ? (
            <div className="tp-submenu mb-1">
              {brokerCats.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="tp-sidebar-item"
                  aria-current={isActive(c.href) ? "page" : undefined}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            className="tp-sidebar-item w-full justify-between"
            onClick={() => setRequirementsOpen((v) => !v)}
            aria-expanded={requirementsOpen}
          >
            <span className="flex items-center gap-2">
              <ClipboardList size={17} /> Requirements
            </span>
            <ChevronDown
              size={15}
              className={`transition-transform ${requirementsOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {requirementsOpen ? (
            <div className="tp-submenu mb-1">
              {requirementCats.map((c) => (
                <Link
                  key={c.href}
                  href={c.href}
                  className="tp-sidebar-item"
                  aria-current={isActive(c.href) ? "page" : undefined}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          ) : null}

          {tail.map(({ key, label, icon: Icon, href }) => {
            const isCallQ = key === "call-queue";
            const isShort = key === "shortlisted";
            const count = isCallQ ? freshCount : isShort ? shortlistCount : 0;
            return (
              <Link
                key={key}
                href={href}
                className="tp-sidebar-item"
                aria-current={isActive(href) ? "page" : undefined}
              >
                <Icon size={17} />
                <span>{label}</span>
                {count > 0 ? (
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${isCallQ ? "bg-[var(--tp-rose)]" : "bg-[var(--tp-accent-2)]"}`}>
                    {count > 99 ? "99+" : count}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <button
            type="button"
            className="tp-sidebar-item w-full justify-between"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            <span className="flex items-center gap-2">
              <MoreHorizontal size={17} /> More
            </span>
            <ChevronDown
              size={15}
              className={`transition-transform ${moreOpen ? "" : "-rotate-90"}`}
            />
          </button>
          {moreOpen ? (
            <div className="tp-submenu mb-1">
              {moreLinks.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="tp-sidebar-item"
                  aria-current={isActive(href) ? "page" : undefined}
                >
                  <Icon size={14} /> {label}
                </Link>
              ))}
            </div>
          ) : null}
          <Link href="/guide" className="tp-sidebar-item">
            <HelpCircle size={17} /> <span>How it works</span>
          </Link>
        </nav>

        <div className="mt-auto pt-4">
          <Link
            href="/broker/agent"
            className="tp-sidebar-item text-[var(--tp-muted)]"
            title="Open the Architech partner desk"
          >
            <ExternalLink size={14} /> <span>Architech desk</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
