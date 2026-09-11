import type { TrustGrade } from "./score";

export type LocalityTrustSummary = {
  slug: string;
  name: string;
  total: number;
  reraVerified: number;
  verifiedPartner: number;
  sourceReviewed: number;
  reraCoveragePct: number;
  avgScore: number;
  grade: TrustGrade;
};
