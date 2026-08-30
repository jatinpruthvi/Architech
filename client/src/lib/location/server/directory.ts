import "server-only";
import { INDIA_STATES_AND_UTS } from "@/lib/location/india-states";
import { getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaDataSource } from "@/lib/repositories/source";

type DirectoryStateRow = {
  id: string;
  code: string | null;
  name: string;
  slug: string | null;
  subtype: string | null;
};

type DirectoryLocalBodyRow = {
  id: string;
  code: string | null;
  name: string;
  slug: string | null;
  subtype: string | null;
  postalCodes: Array<{ postalCode: string }>;
};

type DirectoryPrismaClient = {
  administrativeArea: {
    findFirst(args: unknown): Promise<DirectoryStateRow | null>;
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<DirectoryLocalBodyRow[]>;
  };
};

export async function getLocalBodiesForStateForServer(stateSlug: string, page = 1, requestedPageSize = 50) {
  const stateReference = INDIA_STATES_AND_UTS.find((state) => state.slug === stateSlug);
  if (!stateReference) return null;
  const pageSize = Number.isSafeInteger(requestedPageSize) ? Math.min(100, Math.max(1, requestedPageSize)) : 50;
  const safePage = Number.isSafeInteger(page) ? Math.max(1, Math.min(1_000_000, page)) : 1;
  if (!isPrismaDataSource()) {
    return {
      mode: "reference-only" as const,
      state: { ...stateReference, type: stateReference.kind === "STATE" ? "State" : "Union Territory" },
      localBodies: [],
      pagination: { page: safePage, pageSize, total: 0, totalPages: 0 },
      disclaimer: "Bulk LGD local-body data is available after the official snapshot is applied to the production database.",
    };
  }

  const prisma = getPrismaClient() as unknown as DirectoryPrismaClient;
  const state = await prisma.administrativeArea.findFirst({
    where: { type: "STATE_OR_UT", code: stateReference.lgdCode, isActive: true, source: { key: "lgd-state-ut-registry-2026-08-30", status: "ACTIVE" } },
    select: { id: true, code: true, name: true, slug: true, subtype: true },
  });
  if (!state) throw new Error(`Official LGD state ${stateReference.lgdCode} is not loaded.`);
  const where = {
    type: "LOCAL_BODY",
    parentId: state.id,
    isActive: true,
    source: { key: "lgd-local-bodies-with-pin-codes", status: "ACTIVE" },
  };
  const [total, rows] = await Promise.all([
    prisma.administrativeArea.count({ where }),
    prisma.administrativeArea.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        slug: true,
        subtype: true,
        postalCodes: { where: { validTo: null, source: { key: "lgd-local-bodies-with-pin-codes", status: "ACTIVE" } }, select: { postalCode: true }, orderBy: { postalCode: "asc" } },
      },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    mode: "prisma" as const,
    state: {
      ...stateReference,
      name: state.name,
      slug: state.slug ?? stateReference.slug,
      type: state.subtype ?? (stateReference.kind === "STATE" ? "State" : "Union Territory"),
    },
    localBodies: rows.map((row) => ({
      id: row.id,
      lgdCode: row.code ?? "",
      name: row.name,
      slug: row.slug ?? "",
      type: row.subtype,
      postalCodes: row.postalCodes.map((link) => link.postalCode),
    })),
    pagination: { page: safePage, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    disclaimer: "LGD local bodies are administrative entities. They are not automatically promoted to Architech cities or neighbourhoods.",
  };
}
