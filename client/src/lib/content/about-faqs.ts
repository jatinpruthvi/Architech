/* About-page FAQ copy.
 *
 * Deliberately in its own module with no "use client" and no React import, so
 * BOTH the client component that renders it (`pages/PublicParity.tsx`) and the
 * server component that emits its FAQPage schema (`app/about-us/page.tsx`) can
 * import the same constant.
 *
 * That sharing is the point. Google requires FAQ structured data to describe
 * content visible on the page; keeping one source makes it impossible for the
 * markup and the rendered copy to drift apart as the answers are edited.
 *
 * (It previously lived in the client module. Importing it from a server
 * component serialised it as a client reference instead of an array, and the
 * prerender failed with "a.filter is not a function" — which is exactly the
 * boundary this file exists to respect.) */

export type AboutFaq = { question: string; answer: string };

export const aboutFaqs: readonly AboutFaq[] = [
  {
    question: "What does Architech verify?",
    answer:
      "We keep source, freshness, and RERA context visible where available. Anything that cannot be verified remains clearly marked rather than presented as a fact.",
  },
  {
    question: "Can I list a property?",
    answer:
      "Yes. Owners, agents, and builders can begin the moderated listing flow. Publication remains subject to source, consent, and review checks.",
  },
  {
    question: "Does Architech show reviews?",
    answer:
      "Only real, consented, moderated feedback may be displayed. The Phase 1 preview does not seed testimonials or ratings.",
  },
  {
    question: "Which cities does Architech cover?",
    answer:
      "Architech currently exposes reviewed routes for 12 Indian markets. Each city and locality goes live only when its own source and review context is available.",
  },
];
