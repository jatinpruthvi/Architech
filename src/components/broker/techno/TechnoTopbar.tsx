"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bookmark,
  ChevronDown,
  HelpCircle,
  Home,
  ListChecks,
  Menu,
  MoreHorizontal,
  Phone,
  Search,
  Settings as SettingsIcon,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { normalizeTechnoPathname } from "@/lib/technoproperty/routes";
import { CountBadge, TechnoNavContent } from "./TechnoSidebar";

const NAV = [
  { label: "EXPLORE CITIES", href: "/locations" },
  { label: "FIND RENT", href: "/broker/search" },
  { label: "FIND A HOME", href: "/broker/owners/ResidentialSell" },
  { label: "FIELD NOTES", href: "/broker/activities" },
  { label: "LIST YOUR PROPERTY", href: "/list-property" },
];

const MORE = [
  { label: "How it works", href: "/guide", icon: HelpCircle },
  { label: "Saved search activity", href: "/broker/activities#notifications", icon: Bookmark },
  { label: "Settings", href: "/broker/agent", icon: SettingsIcon },
];

const MOBILE_NAV = [
  { label: "Home", href: "/broker", icon: Home },
  { label: "Search", href: "/broker/search", icon: Search },
  { label: "Calls", href: "/broker/call-queue", icon: Phone },
  { label: "Saved", href: "/broker/shortlisted", icon: Bookmark },
] as const;

export function TechnoTopbar({
  userName = "Broker",
  freshCount = 0,
  shortlistCount = 0,
}: {
  userName?: string;
  freshCount?: number;
  shortlistCount?: number;
}) {
  const pathname = normalizeTechnoPathname(usePathname() ?? "");
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => {
    const [base] = href.split("?");
    return base === "/broker" ? pathname === base : pathname === base || pathname.startsWith(base + "/");
  };

  return (
    <>
      <header role="banner" aria-label="Broker workspace header" className="sticky top-0 z-40 border-b border-cream/15 bg-night text-cream shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center gap-2 px-3 py-2 md:gap-4 md:px-8 md:py-3">
          <button
            type="button"
            className="tp-topbar-icon tp-mobile-only"
            aria-label="Open broker menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={22} />
          </button>

          <Link href="/broker" className="flex min-w-0 shrink items-center gap-2" aria-label="Architech broker home">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brick text-lg font-black text-cream md:h-10 md:w-10 md:rounded-md md:text-xl">
              A
            </span>
            <span className="truncate text-lg font-black tracking-tight md:text-xl">
              Architech<span className="text-ember">.</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-2 text-xs font-bold tracking-wide transition hover:bg-white/10 ${isActive(item.href) ? "bg-white/10 text-gold" : "tp-topbar-link"}`}
              >
                {item.label}
              </Link>
            ))}
            <div className="relative">
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1 rounded px-3 py-2 text-xs font-bold tracking-wide hover:bg-white/10"
                onClick={() => {
                  setMoreOpen((value) => !value);
                  setProfileOpen(false);
                }}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                MORE <ChevronDown size={14} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>
              {moreOpen ? (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--tp-border)] bg-[var(--tp-surface)] text-[var(--tp-ink)] shadow-xl">
                  {MORE.map(({ label, href, icon: Icon }) => (
                    <Link key={href} href={href} role="menuitem" className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--tp-bg)]" onClick={() => setMoreOpen(false)}>
                      <Icon size={16} /> {label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link href="/broker/call-queue" className="tp-topbar-icon relative md:hidden" aria-label={`Call queue, ${freshCount} fresh leads`}>
              <Phone size={19} />
              {freshCount > 0 ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--tp-rose)] ring-2 ring-night" /> : null}
            </Link>
            <Link href="/broker/shortlisted" className="tp-topbar-icon hidden md:grid" title="Saved / Shortlist" aria-label="Saved properties">
              <Bookmark size={17} />
            </Link>
            <span className="ml-1 hidden rounded-full clay-fill bg-brick px-2 py-1 text-[11px] font-black text-cream sm:inline">
              {userName.slice(0, 2).toUpperCase()}
            </span>
            <span className="ml-1 hidden text-xs font-bold uppercase tracking-wide text-white/90 xl:inline">NIVASA DEMO</span>
            <div className="relative">
              <button
                type="button"
                className="tp-topbar-icon"
                aria-label="Account menu"
                onClick={() => {
                  setProfileOpen((value) => !value);
                  setMoreOpen(false);
                }}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span className="text-xs font-black sm:hidden">{userName.slice(0, 2).toUpperCase()}</span>
                <ChevronDown size={15} className="hidden sm:block" />
              </button>
              {profileOpen ? (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--tp-border)] bg-[var(--tp-surface)] text-[var(--tp-ink)] shadow-xl">
                  <div className="border-b border-[var(--tp-border)] px-3 py-3 text-xs text-[var(--tp-muted)]">
                    Signed in as <span className="font-semibold text-[var(--tp-ink)]">{userName}</span>
                  </div>
                  <Link href="/broker/agent" role="menuitem" className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--tp-bg)]" onClick={() => setProfileOpen(false)}>
                    <UserIcon size={16} /> My account
                  </Link>
                  <Link href="/broker/activities" role="menuitem" className="flex min-h-11 items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--tp-bg)]" onClick={() => setProfileOpen(false)}>
                    <ListChecks size={16} /> My activity
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <nav aria-label="Broker mobile navigation" className="tp-mobile-nav md:hidden">
        {MOBILE_NAV.map(({ label, href, icon: Icon }) => {
          const count = label === "Calls" ? freshCount : label === "Saved" ? shortlistCount : 0;
          return (
            <Link
              key={href}
              href={href}
              className="tp-mobile-nav-item"
              aria-current={isActive(href) ? "page" : undefined}
              aria-label={count > 0
                ? `${label}, ${count} ${label === "Calls" ? "fresh leads" : "saved properties"}`
                : undefined}
            >
              <span className="relative">
                <Icon size={20} />
                {count > 0 ? <span className="absolute -right-4 -top-2"><CountBadge count={count} urgent={label === "Calls"} /></span> : null}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
        <button type="button" className="tp-mobile-nav-item" aria-label="Open more navigation" onClick={() => setMenuOpen(true)}>
          <MoreHorizontal size={20} /> <span>More</span>
        </button>
      </nav>

      <Drawer direction="left" open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent className="techno h-dvh w-[min(88vw,22rem)] bg-[var(--tp-surface)] text-[var(--tp-ink)]">
          <DrawerHeader className="flex-row items-start justify-between border-b border-[var(--tp-border)] text-left">
            <div>
              <DrawerTitle className="font-display text-xl text-[var(--tp-ink)]">Broker workspace</DrawerTitle>
              <DrawerDescription className="text-[var(--tp-muted)]">Navigate inventory and daily actions</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <button type="button" className="tp-icon-touch" aria-label="Close broker menu"><X size={20} /></button>
            </DrawerClose>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 safe-bottom-lg">
            <TechnoNavContent freshCount={freshCount} shortlistCount={shortlistCount} onNavigate={() => setMenuOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
