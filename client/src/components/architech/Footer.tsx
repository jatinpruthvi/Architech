"use client";
/* Editorial footer with i18n + translation-status note. */
import Link from "next/link";
import { useLang } from "@/contexts/LangContext";

export default function Footer() {
  const { lang, t } = useLang();
  return (
    <footer className="bg-night text-cream">
      <div className="container pt-20">
        <div className="grid gap-14 pb-16 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <p className="kicker text-ember">{t.footer.made}</p>
            <p className="mt-6 max-w-[340px] font-display text-2xl leading-snug tracking-[-0.02em] text-cream/90">{t.footer.tagline}</p>
            {lang === "hi" && <p className="stamp mt-4 !text-[10px] leading-5 text-cream/60">{t.common.translationNote}</p>}
          </div>
          <nav aria-label={t.footer.explore}>
            <p className="stamp mb-5 text-cream/60">{t.footer.explore}</p>
            <ul role="list" className="space-y-3 text-sm text-cream/80">
              <li><Link href="/buy/" className="link-rail">{t.footer.links.buy}</Link></li>
              <li><Link href="/search/" className="link-rail">{t.footer.links.search}</Link></li>
              <li><Link href="/guide/" className="link-rail">{t.footer.links.notes}</Link></li>
              <li><Link href="/list-property/" className="link-rail">{t.footer.links.listProperty}</Link></li>
              <li><Link href="/home-loan/" className="link-rail">Home loan calculator</Link></li>
              <li><Link href="/blogs/" className="link-rail">Blogs & field notes</Link></li>
            </ul>
          </nav>
          <nav aria-label="Company and trust">
            <p className="stamp mb-5 text-cream/60">Company & trust</p>
            <ul role="list" className="space-y-3 text-sm text-cream/80">
              <li><Link href="/about-us/" className="link-rail">About Architech</Link></li>
              <li><Link href="/contact-us/" className="link-rail">Contact desk</Link></li>
              <li><Link href="/review/" className="link-rail">Give feedback</Link></li>
              <li><Link href="/sitemap.html/" className="link-rail">HTML sitemap</Link></li>
              <li><Link href="/privacy/" className="link-rail">Privacy & terms</Link></li>
            </ul>
          </nav>
          <div>
            <p className="stamp mb-5 text-cream/60">{t.footer.office}</p>
            <p className="stamp leading-6 text-cream/70">Ahmedabad, Gujarat<br />23.03° N · 72.58° E<br />IST (UTC +5:30)</p>
          </div>
        </div>
      </div>
      <div className="overflow-hidden border-t border-cream/10" aria-hidden="true">
        <p className="select-none whitespace-nowrap text-center font-display text-[clamp(70px,14.5vw,210px)] font-medium leading-[0.95] tracking-[-0.04em] text-cream/[0.09]">ARCHITECH</p>
      </div>
      <div className="border-t border-cream/10">
        <div className="container flex flex-col items-start justify-between gap-3 py-6 md:flex-row md:items-center">
          <p className="stamp text-cream/60">© 2026 Architech · Concept prototype — listings, stats & sample records are illustrative</p>
          <p className="stamp text-cream/60">Brick · Plaster · Light — after Kahn, Corbusier & Adalaj</p>
        </div>
      </div>
    </footer>
  );
}
