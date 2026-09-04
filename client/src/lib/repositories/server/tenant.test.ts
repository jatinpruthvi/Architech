import { describe, expect, it } from "vitest";
import {
  TENANT_GUC,
  TenantScopeError,
  assertValidOrgId,
  withTenant,
  withoutTenant,
  type TenantCapableClient,
  type TenantTransactionClient,
} from "./tenant";

/* Records every raw statement so we can assert HOW the tenant is set, not just
   that something ran. The is_local flag is the entire safety property. */
function fakeClient() {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  let inTransaction = false;
  const client: TenantCapableClient = {
    async $transaction(fn) {
      inTransaction = true;
      try {
        const tx: TenantTransactionClient = {
          async $executeRawUnsafe(query, ...values) {
            calls.push({ query, values });
            return 0;
          },
        };
        return await fn(tx);
      } finally {
        inTransaction = false;
      }
    },
  };
  return { client, calls, wasInTransaction: () => inTransaction };
}

describe("tenant scoping for RLS", () => {
  it("sets the GUC the migration actually reads", () => {
    expect(TENANT_GUC).toBe("app.current_org_id");
  });

  it("scopes work to one organization inside a transaction", async () => {
    const { client, calls } = fakeClient();
    const seen = await withTenant(client, "org_1", async () => "done");
    expect(seen).toBe("done");
    expect(calls).toHaveLength(1);
    expect(calls[0].query).toContain("set_config");
  });

  it("uses is_local=true so the value cannot survive onto a pooled connection", async () => {
    /* The single most important assertion in this file. A session-level SET
       would outlive the request and the next brokerage to borrow the
       connection would inherit the tenant. */
    const { client, calls } = fakeClient();
    await withTenant(client, "org_1", async () => null);
    expect(calls[0].query).toMatch(/set_config\(\$1,\s*\$2,\s*true\)/);
  });

  it("passes the organization id as a bound parameter, never interpolated", async () => {
    const { client, calls } = fakeClient();
    await withTenant(client, "org_1", async () => null);
    expect(calls[0].values).toEqual([TENANT_GUC, "org_1"]);
    expect(calls[0].query).not.toContain("org_1");
  });

  it("rejects organization ids that are not plausible identifiers", async () => {
    const { client } = fakeClient();
    for (const bad of ["", "   ", "org 1", "org';DROP TABLE\"Lead\";--", "[object Object]", "org\n1"]) {
      await expect(withTenant(client, bad, async () => null)).rejects.toThrow(TenantScopeError);
    }
  });

  it("rejects a non-string organization id", () => {
    expect(() => assertValidOrgId(undefined as unknown as string)).toThrow(TenantScopeError);
    expect(() => assertValidOrgId(null as unknown as string)).toThrow(TenantScopeError);
  });

  it("accepts a cuid", () => {
    expect(assertValidOrgId("clh3k2j9x0000qwer1234asdf")).toBe("clh3k2j9x0000qwer1234asdf");
  });

  it("propagates errors from the work function without swallowing them", async () => {
    const { client } = fakeClient();
    await expect(
      withTenant(client, "org_1", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("runs the work inside the transaction, not after it", async () => {
    const { client, wasInTransaction } = fakeClient();
    let insideTx = false;
    await withTenant(client, "org_1", async () => {
      insideTx = wasInTransaction();
    });
    expect(insideTx).toBe(true);
  });
});

describe("explicit unscoped access", () => {
  it("clears the tenant rather than granting a wildcard", async () => {
    /* Unscoped means RLS tables return NOTHING. It must never be implemented
       as a bypass, or it becomes a path that reads every tenant. */
    const { client, calls } = fakeClient();
    await withoutTenant(client, "outbox drain worker", async () => null);
    expect(calls[0].query).toContain("set_config");
    expect(calls[0].values).toEqual([TENANT_GUC]);
    expect(calls[0].query).toMatch(/''/);
  });

  it("demands a stated reason, so it cannot be used casually", async () => {
    const { client } = fakeClient();
    await expect(withoutTenant(client, "", async () => null)).rejects.toThrow(TenantScopeError);
    await expect(withoutTenant(client, "adhoc", async () => null)).rejects.toThrow(/at least 8/);
  });
});
