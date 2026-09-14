"use client";
/* Editorial footer with i18n + translation-status note.
   Was a full-bleed `bg-night text-cream` slab. On a light aurora page a single
   hard dark band reads as a copy-paste accident, so the footer is now the same
   frosted material as every other panel — it sits on the canvas rather than
   punching a hole in it. */
import Link from "next/link";
import { useLang } from "@/contexts/LangContext";

export default function Footer() {
  const { lang, t } = useLang();
  return (
    <footer className="pb-10">
      <div className="container">
        <div className="glass rounded-[1.25rem] p-7 md:p-10">
          <div className="grid gap-12 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
            <div>
              <p className="kicker text-brick">{t.footer.made}</p>
              <p className="mt-6 max-w-[340px] font-display text-2xl leading-snug tracking-[-0.02em] text-ink">{t.footer.tagline}</p>
              {lang === "hi" && <p className="stamp-sm mt-4 leading-5 text-ink/55">{t.common.translationNote}</p>}
            </div>
            <nav aria-label={t.footer.explore}>
              <p className="stamp mb-5 text-ink/55">{t.footer.explore}</p>
              <ul role="list" className="space-y-3 text-sm text-ink/75">
                <li><Link href="/buy/" className="link-rail">{t.footer.links.buy}</Link></li>
                {/* The rent hub needs a real inbound link, not just a sitemap
                    entry: the crawl simulation fails a URL it advertises but
                    cannot reach, and a hub nothing links to gets no authority. */}
                <li><Link href="/rent/" className="link-rail">{t.footer.links.rent}</Link></li>
                <li><Link href="/search/" className="link-rail">{t.footer.links.search}</Link></li>
                <li><Link href="/guide/" className="link-rail">{t.footer.links.notes}</Link></li>
                <li><Link href="/list-property/" className="link-rail">{t.footer.links.listProperty}</Link></li>
                <li><Link href="/home-loan/" className="link-rail">Home loan calculator</Link></li>
                <li><Link href="/price-index/" className="link-rail">City price index</Link></li>
                <li><Link href="/agents/" className="link-rail">Verified agents</Link></li>
                <li><Link href="/blogs/" className="link-rail">Blogs & field notes</Link></li>
                <li><Link href="/locations/" className="link-rail">India location & PIN directory</Link></li>
              </ul>
            </nav>
            <nav aria-label="Company and trust">
              <p className="stamp mb-5 text-ink/55">Company & trust</p>
              <ul role="list" className="space-y-3 text-sm text-ink/75">
                <li><Link href="/about-us/" className="link-rail">About Architech</Link></li>
                <li><Link href="/contact-us/" className="link-rail">Contact desk</Link></li>
                <li><Link href="/review/" className="link-rail">Give feedback</Link></li>
                <li><Link href="/sitemap.html" className="link-rail">HTML sitemap</Link></li>
                <li><Link href="/privacy/" className="link-rail">Privacy & terms</Link></li>
              </ul>
            </nav>
            <div>
              <p className="stamp mb-5 text-ink/55">{t.footer.office}</p>
              <p className="stamp-sm leading-6 text-ink/60">India coverage desk<br />Digital-first · city-scoped review<br />IST (UTC +5:30)</p>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-ink/10 pt-6 md:flex-row md:items-center">
            <p className="stamp-sm text-ink/55">© 2026 Architech · Property listings and market stats may use labelled demo records; official references retain their source trails</p>
            <p className="stamp-sm text-ink/55">Aurora survey · Glass · Luminous field — a country drawn in daylight</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
