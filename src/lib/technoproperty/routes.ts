const TECHNO_WORKSPACE_ROOTS = [
  "/broker/search",
  "/broker/owners",
  "/broker/brokers",
  "/broker/buyers",
  "/broker/requirements",
  "/broker/shortlisted",
  "/broker/premium",
  "/broker/activities",
  "/broker/call-queue",
] as const;

export function normalizeTechnoPathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Routes that own their navigation chrome through the Techno broker layout. */
export function isTechnoWorkspacePath(pathname: string): boolean {
  const normalized = normalizeTechnoPathname(pathname);
  if (normalized === "/broker") return true;
  return TECHNO_WORKSPACE_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  );
}
