/* ARCHITECH — Amdavad Modern shell: brick-and-plaster header, editorial footer, crawlable routes. */
import { useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { ArrowUpRight, Bookmark, Menu, Search, X } from "lucide-react";
import Home from "./pages/Home";
import CityPage from "./pages/CityPage";
import ResultsPage from "./pages/ResultsPage";
import ListingPage from "./pages/ListingPage";
import Guide from "./pages/Guide";
import Saved from "./pages/Saved";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";

const navItems = [
  { href: "/buy/ahmedabad/", label: "Explore Ahmedabad" },
  { href: "/search", label: "Find a home" },
  { href: "/guide", label: "Field notes" },
];

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();
  const onDark = location === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location]);

  /* Keyboard support: Escape closes the mobile menu */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${onDark ? "bg-transparent text-paper" : "border-b border-ink/10 bg-paper/95 text-ink backdrop-blur-xl"}`}>
      <div className="container flex h-[78px] items-center justify-between">
        <Link href="/" className="group flex items-center gap-3" aria-label="Architech home">
          <span className="arch-mark grid h-11 w-11 place-items-center" aria-hidden="true"><span className="arch-mark-arch" /></span>
          <span className="font-display text-[24px] font-medium tracking-[-0.03em]">Architech<span className="text-brick">.</span></span>
        </Link>
        <nav className="hidden items-center gap-9 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`link-rail stamp !text-[12px] font-medium ${onDark ? "text-paper/85" : "text-ink/75"} hover:opacity-100`}>{item.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Link href="/saved" className={`inline-flex items-center gap-2 stamp !text-[12px] font-medium ${onDark ? "text-paper/85" : "text-ink/75"} link-rail`}><Bookmark size={14} strokeWidth={1.8} /> Saved</Link>
          <Link href="/search" className="btn-sweep motion-press inline-flex items-center gap-2 bg-brick px-5 py-3 stamp !text-[12px] font-semibold text-paper"><Search size={14} /> Start exploring</Link>
        </div>
        <button className={`grid h-11 w-11 place-items-center md:hidden ${onDark ? "text-paper" : "text-ink"}`} onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-ink/10 bg-paper text-ink md:hidden">
          <nav className="container flex flex-col pb-8 pt-4" aria-label="Mobile navigation">
            {navItems.map((item, i) => (
              <Link key={item.href} href={item.href} className="flex items-center justify-between border-b border-ink/10 py-5 font-display text-3xl tracking-[-0.02em]" style={{ animationDelay: `${i * 60}ms` }}>
                {item.label} <ArrowUpRight size={20} className="text-brick" />
              </Link>
            ))}
            <Link href="/saved" className="mt-6 stamp font-semibold text-brick">View saved homes →</Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-ink text-paper">
      <div className="container pt-20">
        <div className="grid gap-14 pb-16 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <p className="kicker text-ember">Made in Amdavad</p>
            <p className="mt-6 max-w-[340px] font-display text-2xl leading-snug tracking-[-0.02em] text-paper/90">Find the place before you choose the address.</p>
          </div>
          <nav aria-label="Explore">
            <p className="stamp mb-5 text-paper/45">Explore</p>
            <ul className="space-y-3 text-sm text-paper/80">
              <li><Link href="/buy/ahmedabad/" className="link-rail">Buy in Ahmedabad</Link></li>
              <li><Link href="/search" className="link-rail">Search homes</Link></li>
              <li><Link href="/guide" className="link-rail">Field notes</Link></li>
            </ul>
          </nav>
          <nav aria-label="Trust">
            <p className="stamp mb-5 text-paper/45">Trust</p>
            <ul className="space-y-3 text-sm text-paper/80">
              <li><Link href="/guide" className="link-rail">How we verify</Link></li>
              <li><Link href="/guide" className="link-rail">RERA methodology</Link></li>
              <li><Link href="/saved" className="link-rail">Saved homes</Link></li>
            </ul>
          </nav>
          <div>
            <p className="stamp mb-5 text-paper/45">Field office</p>
            <p className="stamp leading-6 text-paper/70">Ahmedabad, Gujarat<br />23.03° N · 72.58° E<br />IST (UTC +5:30)</p>
          </div>
        </div>
      </div>
      <div className="overflow-hidden border-t border-paper/10" aria-hidden="true">
        <p className="select-none whitespace-nowrap text-center font-display text-[clamp(70px,14.5vw,210px)] font-medium leading-[0.95] tracking-[-0.04em] text-paper/[0.09]">ARCHITECH</p>
      </div>
      <div className="border-t border-paper/10">
        <div className="container flex flex-col items-start justify-between gap-3 py-6 md:flex-row md:items-center">
          <p className="stamp text-paper/45">© 2026 Architech · A high-trust home discovery study</p>
          <p className="stamp text-paper/45">Brick · Plaster · Light — after Kahn, Corbusier & Adalaj</p>
        </div>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

export default function App() {
  const [location] = useLocation();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="bottom-right" />
          <ScrollToTop />
          <a href="#main" className="skip-link">Skip to content</a>
          <SiteHeader />
          <main id="main" key={location} className="page-transition">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/buy/ahmedabad/" component={CityPage} />
              <Route path="/buy/ahmedabad" component={CityPage} />
              <Route path="/search" component={ResultsPage} />
              <Route path="/listing/:id" component={ListingPage} />
              <Route path="/guide" component={Guide} />
              <Route path="/saved" component={Saved} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <SiteFooter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
