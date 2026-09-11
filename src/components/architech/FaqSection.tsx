import type { FaqEntry } from "@/lib/seo/faq";

/* Renders the FAQ entries that `buildFaqPage` marks up.
 *
 * This component and the JSON-LD must be driven by the SAME array. Google
 * requires FAQ structured data to describe content visible on the page, and a
 * mismatch is a manual-action risk, not a style problem. Keeping the rendering
 * in one component means a page cannot emit the schema and forget the copy —
 * the failure mode that makes FAQ markup a liability instead of a rich result.
 *
 * Answers live in open `<details>`-style markup rather than a JS accordion so
 * the text is in the raw HTML for crawlers that do not execute scripts. */
export function FaqSection({
  entries,
  heading,
  id = "faq",
}: {
  entries: readonly FaqEntry[];
  heading: string;
  id?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <section id={id} className="container border-t border-ink/15 py-14 md:py-20" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="font-display text-[26px] font-medium tracking-[-0.02em] md:text-[34px]">
        {heading}
      </h2>
      <div className="mt-6 border-t border-ink/15">
        {entries.map((entry) => (
          <details key={entry.question} className="group border-b border-ink/15 py-5" open>
            <summary className="cursor-pointer list-none font-display text-lg group-open:text-brick">
              {entry.question}
            </summary>
            <p className="mt-3 max-w-3xl text-sm leading-7 ink-2">{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export default FaqSection;
