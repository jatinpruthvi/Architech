import "server-only";

/* Tenant scoping for row-level security.

   The RLS policies in 202609030004_row_level_security read the
   `app.current_org_id` session GUC. This module is the only sanctioned way to
   set it, and it exists because the dangerous part of RLS is not the SQL --
   it is the application forgetting to scope a connection, or worse, scoping it
   and then leaving the value behind.

   THE POOLING HAZARD

   getPrismaClient() returns a process-wide singleton over a pg connection
   pool. Connections are handed out, returned, and handed to the NEXT request,
   which may belong to a different brokerage. If a tenant were set with a plain
   session-level `SET`, it would survive the connection's return to the pool and
   the next request would inherit it. That is a silent cross-tenant read, and it
   is the single most common way RLS deployments leak.

   The defence is that every tenant-scoped query runs inside a transaction and
   sets the GUC with `set_config(..., is_local => true)`, which PostgreSQL
   discards at COMMIT or ROLLBACK. There is no code path that sets the tenant
   outside a transaction. Verified end to end in the RLS suite: a transaction
   sees its tenant's rows, and the very next statement on the same connection
   sees none.

   FAIL CLOSED

   An unset GUC makes every policy evaluate to NULL, which is not TRUE, so an
   unscoped connection reads zero rows. A forgotten scope therefore produces an
   obviously empty result rather than someone else's data. */

/** Session GUC the RLS policies read. Must match the migration exactly. */
export const TENANT_GUC = "app.current_org_id";

/* Organization ids are cuids, but this is a defence-in-depth check rather than
   a format assertion: the value is always passed as a bound parameter to
   set_config, never interpolated, so injection is not possible through it. The
   check catches accidental garbage (an object stringified to "[object Object]",
   an empty string, a stray newline) before it silently becomes "no tenant". */
const ORG_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

export function assertValidOrgId(organizationId: string): string {
  if (typeof organizationId !== "string" || !ORG_ID_PATTERN.test(organizationId)) {
    throw new TenantScopeError(
      `Invalid organization id for tenant scope: ${JSON.stringify(organizationId)}.`,
    );
  }
  return organizationId;
}

/** Minimal surface we need from the Prisma client, so this file stays testable. */
export type TenantCapableClient = {
  $transaction<T>(fn: (tx: TenantTransactionClient) => Promise<T>): Promise<T>;
};

export type TenantTransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};

/* Run `work` inside a transaction scoped to one organization.

   Every tenant-owned read or write must go through here. The GUC is set with
   is_local => true so PostgreSQL clears it when the transaction ends, however
   it ends -- commit, rollback, or an exception thrown by `work`. Nothing leaks
   onto the pooled connection.

   set_config is called with a BOUND PARAMETER, never string interpolation. */
export async function withTenant<T>(
  client: TenantCapableClient,
  organizationId: string,
  work: (tx: TenantTransactionClient) => Promise<T>,
): Promise<T> {
  const orgId = assertValidOrgId(organizationId);
  return client.$transaction(async (tx) => {
    // Third argument `true` = is_local: scoped to this transaction only.
    await tx.$executeRawUnsafe(`SELECT set_config($1, $2, true)`, TENANT_GUC, orgId);
    return work(tx);
  });
}

/* Escape hatch for genuinely cross-tenant platform work: moderation queues,
   the outbox drain, reconciliation sweeps.

   Deliberately NOT implemented as "set a wildcard tenant" or "bypass RLS",
   because both would create a code path that reads everything. Instead the
   caller must state the reason, which is recorded, and the work still runs
   with NO tenant set -- meaning RLS-protected tables return nothing. A platform
   job that needs those rows must use a separately-credentialed connection whose
   role is granted explicit access, which is an operator decision rather than
   something application code can quietly award itself. */
export async function withoutTenant<T>(
  client: TenantCapableClient,
  reason: string,
  work: (tx: TenantTransactionClient) => Promise<T>,
): Promise<T> {
  if (!reason || reason.trim().length < 8) {
    throw new TenantScopeError("withoutTenant requires an explicit reason of at least 8 characters.");
  }
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config($1, '', true)`, TENANT_GUC);
    return work(tx);
  });
}
