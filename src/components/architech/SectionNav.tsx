"use client";
/* ARCHITECH — in-page section rail for the listing dossier.
 *
 * WHY: the dossier runs ~3000px with no way to orient yourself in it. The
 * sticky aside answers "how do I contact someone", nothing answers "where am
 * I, and where is the price history". The established pattern for a long
 * dossier is an anchor bar; ours had `aria-labelledby` headings but no `id`s
 * to link to, so there was nothing to build on.
 *
 * HOW the active state is decided — deliberately NOT IntersectionObserver.
 * IO tells you what is on screen, which is ambiguous exactly when two sections
 * share the viewport, and it needs a different algorithm on the way down than
 * on the way up. One rAF-throttled scroll handler asks a different question:
 * "what is the LAST section whose top has passed my reading line?" — which is
 * direction-free, costs nothing when idle, and stops arguing at section
 * boundaries. The reading line is the header (78px) plus the jump offset
 * (96px, see theme.css `[id]`), so the rail agrees with where an anchor lands.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

export type SectionAnchor = { id: string; label: string };

export function SectionNav({ sections, label }: { sections: SectionAnchor[]; label: string }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    /* One listener for the whole rail, not a ResizeObserver per heading: this
       file is ~3000px tall and the offsets are cheap to read on demand. */
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = 78 + 96 + 8; // fixed header + scroll-margin + a hair
      let next: string | null = null;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top <= line) next = section.id;
      }
      // Near the top of the dossier nothing has passed the line yet; lighting
      // up the first item there would be a lie.
      setActive(window.scrollY < 240 ? null : next);
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  const jumpToTop = () => {
    /* A button, deliberately not a link: returning to the top of a 3000px page
       is an action rather than a destination, and giving it an href would mean
       inventing a target id purely so the anchor resolves — the exact
       dead-anchor shape the design-token guard now fails the build on. */
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <nav aria-label={label} className="sticky top-[78px] z-30 -mx-4 mb-10 border-y border-ink/12 bg-paper/95 px-4 backdrop-blur-sm lg:static lg:mx-0 lg:border-y-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
      <ul role="list" className="section-rail stamp-sm font-semibold ink-3">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              href={`#${section.id}`}
              className={`section-rail-link px-2.5 py-3 transition-colors hover:text-ink ${active === section.id ? "text-ink" : ""}`}
              aria-current={active === section.id || undefined}
            >
              {section.label}
            </Link>
          </li>
        ))}
        {/* Hidden below lg on purpose: on a phone the dossier already ends in a
            sticky CTA bar, and two stacked bars eat the viewport. The section
            items keep `text-ink` from theme.css's UNLAYERED `.section-rail-link`
            rule — no `!important` needed, because an unlayered rule outranks
            `@layer utilities` at any specificity. */}
        <li className="ml-auto hidden lg:block">
          <button type="button" onClick={jumpToTop} className="section-rail-link px-2.5 py-3 hover:text-brick">
            ↑ Top
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default SectionNav;
