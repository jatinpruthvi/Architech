"use client";
/* Site header: scroll-aware, theme toggle, Hindi toggle, saved badge, mobile menu. */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bookmark, Languages, Menu, Moon, Search, Sun, X } from "lucide-react";
import { useSaved } from "@/contexts/SavedContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLang } from "@/contexts/LangContext";

const RequirementCapture = dynamic(() => import("@/components/architech/RequirementCapture"), {
  ssr: false,
  loading: () => (
    <span className="hidden border border-ember/40 px-4 py-2.5 stamp font-semibold text-ember/70 lg:inline-flex">
      Tell us what you need
    </span>
  ),
});

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { saved } = useSaved();
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const onDark = pathname === "/" && !scrolled;

  const navItems = [
    { href: "/buy/", label: t.nav.explore },
    { href: "/search/", label: t.nav.find },
    { href: "/guide/", label: t.nav.notes },
    { href: "/list-property/", label: t.nav.list },
    { href: "/sitemap.html", label: "More" },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const iconBtn = `grid h-10 w-10 place-items-center rounded-xl border transition-colors ${onDark ? "border-cream/25 text-cream/85 hover:border-ember hover:text-ember" : "border-ink/15 text-ink/70 hover:border-brick hover:text-brick"}`;

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${onDark ? "bg-transparent text-cream" : "border-b border-ink/10 bg-paper/95 text-ink backdrop-blur-xl"}`}>
      <div className="container flex h-[78px] items-center justify-between gap-3">
        <Link href="/" className="group flex items-center gap-3" aria-label="Architech home">
          <span className="arch-mark grid h-12 w-12 place-items-center" aria-hidden="true"><span className="arch-mark-arch" /></span>
          <span className="font-display text-[26px] font-medium tracking-[-0.04em]">Architech<span className="text-brick">.</span></span>
        </Link>
        <nav className="hidden items-center gap-9 lg:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`link-rail stamp !text-[12px] font-medium ${onDark ? "text-cream/85" : "text-ink/75"} hover:opacity-100`}>{item.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 md:gap-3">
          <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className={iconBtn} aria-label={lang === "en" ? "हिन्दी में देखें" : "Switch to English"} title={lang === "en" ? "हिन्दी" : "English"}>
            <span className="flex items-center gap-1 stamp !text-[10px] font-bold"><Languages size={13} aria-hidden="true" />{lang === "en" ? "हिं" : "EN"}</span>
          </button>
          <button onClick={toggleTheme} className={iconBtn} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "dark"}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link href="/saved/" className={`relative hidden items-center gap-2 stamp !text-[12px] font-medium md:inline-flex ${onDark ? "text-cream/85" : "text-ink/75"} link-rail`}>
            <Bookmark size={14} strokeWidth={1.8} /> {t.nav.saved}
            {saved.length > 0 && <span className="clay-fill grid h-4.5 min-w-[18px] place-items-center rounded-full bg-brick px-1 text-[10px] font-bold text-cream">{saved.length}</span>}
          </Link>
          <RequirementCapture compact />
          <Link href="/search/" className="clay-fill btn-sweep btn-primary motion-press hidden items-center gap-2 border border-white/15 bg-brick px-5 py-3 stamp !text-[12px] font-semibold text-cream md:inline-flex"><Search size={14} /> {t.nav.start}</Link>
          <button className={`grid h-11 w-11 place-items-center lg:hidden ${onDark ? "text-cream" : "text-ink"}`} onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-ink/10 bg-paper text-ink lg:hidden">
          <nav className="container flex flex-col pb-8 pt-4" aria-label="Mobile navigation">
            {navItems.map((item, i) => (
              <Link key={item.href} href={item.href} ref={i === 0 ? firstLinkRef : undefined} className="flex items-center justify-between border-b border-ink/10 py-5 font-display text-3xl tracking-[-0.02em]" style={{ animationDelay: `${i * 60}ms` }}>
                {item.label} <ArrowUpRight size={20} className="text-brick" />
              </Link>
            ))}
            <Link href="/requirements/" className="mt-6 stamp font-semibold text-brick">Tell us what you need →</Link>
            <Link href="/saved/" className="mt-3 stamp font-semibold text-brick">{t.nav.saved} {saved.length > 0 ? `(${saved.length})` : ""} →</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
