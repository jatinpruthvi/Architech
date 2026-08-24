export type Guide = {
  id: string;
  slug: string;
  title: string;
  tag: string;
  time: string;
  image: string;
  status: "prototype" | "editorial-review" | "published";
};

const guides: Guide[] = [
  { id: "verify-rera", slug: "how-we-verify-rera", title: "How we verify a listing against Gujarat RERA", tag: "Methodology", time: "6 min read", image: "brick-arch", status: "editorial-review" },
  { id: "paldi-trees", slug: "paldi-neighbourhood-trees", title: "Paldi: reading a neighbourhood by its trees", tag: "Locality study", time: "8 min read", image: "locality-street", status: "editorial-review" },
  { id: "adalaj-trust", slug: "adalaj-trust-in-layers", title: "What Adalaj teaches us about trust in layers", tag: "Essay", time: "5 min read", image: "stepwell", status: "editorial-review" },
];

export function getGuides(): Guide[] {
  return guides;
}
