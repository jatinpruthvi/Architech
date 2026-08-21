/* Architech Editorial Terracotta: public-first navigation, restrained motion, crawlable links, and a shared shell for all vertical slices. */
import { useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { ArrowUpRight, Bookmark, Menu, Search, X } from "lucide-react";
import Home from "./pages/Home";
import CityPage from "./pages/CityPage";
import ResultsPage from "./pages/ResultsPage";
import ListingPage from "./pages/ListingPage";
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled || location !== "/" ? "bg-paper/95 text-ink shadow-[0_8px_30px_rgba(39,34,28,.08)] backdrop-blur-xl" : "bg-ink/20 text-paper backdrop-blur-sm"}`}>
      <div className="container flex h-[76px] items-center justify-between">
        <Link href="/" className="group flex items-center gap-3" aria-label="Architech home">
          <span className="grid h-11 w-11 place-items-center bg-ink p-2 transition-transform duration-200 group-hover:-rotate-3"><span className="pointer-events-none absolute h-2 w-2 translate-x-2 translate-y-2 bg-clay" />
            <img src="/manus-storage/architech-ahmedabad-mark_ce9283a3.png" alt="" className="h-full w-full object-contain" />
          </span>
          <span className={`font-display text-[22px] font-semibold tracking-[-.055em] uppercase ${scrolled || location !== "/" ? "text-ink" : "text-paper"}`}>architech<span className="text-clay">.</span></span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => <Link key={item.href} href={item.href} className={`text-[13px] font-medium tracking-[.03em] transition-colors hover:text-clay ${scrolled || location !== "/" ? "text-ink/70" : "text-paper/80"}`}>{item.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/saved" className={`inline-flex items-center gap-2 text-[13px] font-medium hover:text-clay ${scrolled || location !== "/" ? "text-ink/70" : "text-paper/80"}`}><Bookmark size={15} strokeWidth={1.7} /> Saved</Link>
          <Link href="/search" className="inline-flex items-center gap-2 bg-[var(--clay)] px-4 py-2.5 text-[13px] font-semibold text-paper transition-transform duration-200 hover:-translate-y-0.5"><Search size={15} /> Start exploring <ArrowUpRight size={14} /></Link>
        </div>
        <button className={`grid h-10 w-10 place-items-center md:hidden ${scrolled || location !== "/" ? "text-ink" : "text-paper"}`} onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {open && <div className="border-t border-ink/10 bg-paper px-4 pb-5 pt-4 md:hidden">
        <nav className="container flex flex-col gap-1" aria-label="Mobile navigation">
          {navItems.map((item) => <Link key={item.href} href={item.href} className="border-b border-ink/10 py-4 font-display text-2xl text-ink">{item.label}</Link>)}
          <Link href="/saved" className="py-4 text-sm font-semibold text-clay">View saved homes</Link>
        </nav>
      </div>}
    </header>
  );
}

function AppRoutes() {
  return <>
    <SiteHeader />
    <main>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/buy/ahmedabad/" component={CityPage} />
        <Route path="/search" component={ResultsPage} />
        <Route path="/listing/:id" component={ListingPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </main>
    <footer className="border-t border-ink/10 bg-paper py-10">
      <div className="container flex flex-col gap-5 text-sm text-ink/60 md:flex-row md:items-center md:justify-between">
        <p className="font-display text-lg text-ink">A better way to understand a place.</p>
        <div className="flex gap-5"><Link href="/guide" className="hover:text-clay">Methodology</Link><Link href="/buy/ahmedabad/" className="hover:text-clay">Ahmedabad homes</Link><Link href="/search" className="hover:text-clay">Search</Link></div>
      </div>
    </footer>
  </>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><AppRoutes /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
