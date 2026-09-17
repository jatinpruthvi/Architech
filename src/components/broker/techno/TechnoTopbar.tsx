"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HelpCircle,
  Search,
  Sun,
  Moon,
  Bookmark,
  Type,
  ChevronDown,
  LogOut,
  Settings as SettingsIcon,
  User as UserIcon,
} from "lucide-react";

const NAV = [
  { label: "EXPLORE CITIES", href: "/cities" },
  { label: "FIND RENT", href: "/broker/search" },
  { label: "FIND A HOME", href: "/broker/search?purpose=buy" },
  { label: "FIELD NOTES", href: "/broker/activities" },
  { label: "LIST YOUR PROPERTY", href: "/list" },
];

const MORE = [
  { label: "How it works", href: "/guide", icon: HelpCircle },
  { label: "Saved searches", href: "/broker/search?saved=1", icon: Bookmark },
  { label: "Settings", href: "/broker/agent", icon: SettingsIcon },
  { label: "Sign out", href: "/logout", icon: LogOut },
];

export function TechnoTopbar({ userName = "Broker" }: { userName?: string }) {
  const pathname = usePathname() ?? "";
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");

  const isActive = (href: string) => {
    if (href.includes("?")) {
      const [base] = href.split("?");
      return pathname === base;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="sticky top-0 z-40 border-b border-[#6d5b44]/20 bg-[#5d4a36] text-white shadow-sm">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 md:px-8">
        {/* Logo */}
        <Link href="/broker" className="flex items-center gap-2 shrink-0" aria-label="Architech home">
          <span
            className="grid h-10 w-10 place-items-center rounded-md bg-black text-[#ffb74d] font-black text-xl"
            style={{ background: "linear-gradient(135deg,#111,#333)" }}
          >
            A
          </span>
          <span className="text-xl font-black tracking-tight">
            Architech<span className="text-[#ffb74d]">.</span>
          </span>
        </Link>

        {/* Primary nav */}
        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded px-3 py-2 text-xs font-bold tracking-wide transition hover:bg-white/10 ${
                isActive(n.href) ? "bg-white/10 text-[#ffd79a]" : "text-white/85"
              }`}
            >
              {n.label}
            </Link>
          ))}
          {/* More dropdown */}
          <div className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-3 py-2 text-xs font-bold tracking-wide hover:bg-white/10"
              onClick={() => {
                setMoreOpen((v) => !v);
                setProfileOpen(false);
              }}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
            >
              MORE
              <ChevronDown size={12} className={`transition-transform ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen ? (
              <div
                className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-[var(--tp-border)] bg-white text-[var(--tp-ink)] shadow-xl"
                onMouseLeave={() => setMoreOpen(false)}
              >
                {MORE.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--tp-bg)]"
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon size={14} /> {label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        {/* Right side: utility icons + profile */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            title="Adjust font size"
            aria-label="Adjust font size"
            onClick={() => setFontSize(fontSize === "sm" ? "md" : fontSize === "md" ? "lg" : "sm")}
          >
            <Type size={16} />
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            aria-label="Toggle theme"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link
            href="/broker/shortlisted"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            title="Saved / Shortlist"
            aria-label="Saved"
          >
            <Bookmark size={16} />
          </Link>
          <span className="ml-1 rounded-full bg-[#f29633] px-2 py-0.5 text-[11px] font-black text-white">
            {userName.slice(0, 2).toUpperCase()}
          </span>
          <span className="ml-1 hidden text-xs font-bold uppercase tracking-wide text-white/90 sm:inline">
            NIVASA DEMO
          </span>
          <div className="relative">
            <button
              type="button"
              className="ml-1 grid h-8 w-8 place-items-center rounded-full hover:bg-white/10"
              aria-label="Account menu"
              onClick={() => {
                setProfileOpen((v) => !v);
                setMoreOpen(false);
              }}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <ChevronDown size={14} />
            </button>
            {profileOpen ? (
              <div
                className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-[var(--tp-border)] bg-white text-[var(--tp-ink)] shadow-xl"
                onMouseLeave={() => setProfileOpen(false)}
              >
                <div className="border-b border-[var(--tp-border)] px-3 py-2 text-xs text-[var(--tp-muted)]">
                  Signed in as <span className="font-semibold text-[var(--tp-ink)]">{userName}</span>
                </div>
                <Link
                  href="/broker/agent"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--tp-bg)]"
                  onClick={() => setProfileOpen(false)}
                >
                  <UserIcon size={14} /> My account
                </Link>
                <Link
                  href="/guide"
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--tp-bg)]"
                  onClick={() => setProfileOpen(false)}
                >
                  <HelpCircle size={14} /> How it works
                </Link>
                <Link
                  href="/broker/search"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[var(--tp-accent)] hover:bg-[var(--tp-bg)]"
                  onClick={() => setProfileOpen(false)}
                >
                  <Search size={14} /> Search Property
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
