-- Row-level security: tenant isolation enforced by PostgreSQL, not by callers.
--
-- WHY THIS EXISTS
--
-- Today isolation is a convention: every broker query remembers to pass
-- `where: { brokerOrgId: ... }`. That works until one query forgets, and then
-- one brokerage reads another's inventory with no error and no signal. The
-- broker channel makes that failure mode materially worse, because two
-- competing agencies will hold rows in the same tables by design.
--
-- RLS moves the guarantee from "every developer remembers" to "the database
-- refuses". A forgotten WHERE clause returns zero rows instead of someone
-- else's data.
--
-- THE TENANT KEY
--
-- Policies read `app.current_org_id`, a session GUC set per request. It is read
-- through current_setting(..., true) so an unset GUC yields NULL rather than
-- raising, which makes the default deny-everything instead of error-out.
--
-- FAIL-CLOSED IS THE WHOLE POINT
--
-- Every policy below compares against a NULL-safe expression. When the GUC is
-- unset, `"brokerOrgId" = NULLIF(current_setting('app.current_org_id', true), '')`
-- is NULL, which is not TRUE, so no row qualifies. An un-scoped connection sees
-- nothing. That is the desired behaviour: a bug that forgets to set the tenant
-- produces an obvious empty result, never a cross-tenant leak.
--
-- WHY FORCE ROW LEVEL SECURITY
--
-- Plain ENABLE exempts the table owner, and migrations typically run as the
-- owner, so the application role frequently IS the owner in small deployments.
-- FORCE removes that exemption so the owner is policed too. The only way to
-- bypass is BYPASSRLS or superuser, which the application role must not have --
-- asserted by scripts/security/rls-audit.mjs.
--
-- PUBLIC DATA IS DELIBERATELY NOT COVERED
--
-- City, Locality, PostalCode, Listing and similar tables back the public
-- property site, which is read by anonymous visitors with no tenant. Putting
-- RLS on them would either break the public site or require a policy so broad
-- it guarantees nothing. Listing already carries brokerOrgId and is filtered in
-- application code for broker views; its public reads must stay unrestricted.
-- Tenant-private tables are the ones enumerated here.

-- ---------------------------------------------------------------------------
-- 1. Helper: the current tenant, or NULL
-- ---------------------------------------------------------------------------
-- NULLIF maps the empty string to NULL so that `SET app.current_org_id = ''`
-- (which is what a naive "clear the tenant" implementation produces) is treated
-- as absent rather than as a tenant literally named ''.
--
-- STABLE, not IMMUTABLE: the value can change between statements in a session.
-- Marking it IMMUTABLE would let the planner cache it across a tenant switch on
-- a pooled connection -- the exact cross-tenant leak this migration prevents.
CREATE OR REPLACE FUNCTION architech_current_org_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '');
$$;

COMMENT ON FUNCTION architech_current_org_id() IS
  'Current tenant from the app.current_org_id GUC, or NULL when unset. NULL denies every RLS policy.';

-- ---------------------------------------------------------------------------
-- 2. Lead -- customer enquiries, the most sensitive tenant-owned table
-- ---------------------------------------------------------------------------
-- Lead.organizationId is nullable: a public enquiry can arrive before it is
-- routed to a brokerage. Those unassigned rows must NOT be visible to an
-- arbitrary tenant, so the policy requires a non-null match. Admin/back-office
-- access to unrouted leads runs through a separate privileged path, not by
-- weakening this policy.
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" FORCE ROW LEVEL SECURITY;

CREATE POLICY "Lead_tenant_isolation" ON "Lead"
  USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());

-- ---------------------------------------------------------------------------
-- 3. InteropOutbox -- outbound projections carrying commercial facts
-- ---------------------------------------------------------------------------
-- organizationId is NOT NULL here, so the comparison is a plain equality.
ALTER TABLE "InteropOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InteropOutbox" FORCE ROW LEVEL SECURITY;

CREATE POLICY "InteropOutbox_tenant_isolation" ON "InteropOutbox"
  USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());

-- ---------------------------------------------------------------------------
-- 4. InteropInboundEvent -- webhook de-duplication ledger
-- ---------------------------------------------------------------------------
-- organizationId is nullable because some provider callbacks arrive before we
-- can attribute them. Unattributed rows are visible to no tenant, which is
-- correct: the de-duplication worker runs on a privileged path.
ALTER TABLE "InteropInboundEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InteropInboundEvent" FORCE ROW LEVEL SECURITY;

CREATE POLICY "InteropInboundEvent_tenant_isolation" ON "InteropInboundEvent"
  USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());

-- ---------------------------------------------------------------------------
-- 5. BrokerUser -- membership, i.e. who belongs to which brokerage
-- ---------------------------------------------------------------------------
-- Leaking this leaks a competitor's staff roster.
ALTER TABLE "BrokerUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrokerUser" FORCE ROW LEVEL SECURITY;

CREATE POLICY "BrokerUser_tenant_isolation" ON "BrokerUser"
  USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());

-- ---------------------------------------------------------------------------
-- 6. AuditEvent -- append-only, and must stay that way
-- ---------------------------------------------------------------------------
-- Split into per-command policies rather than one blanket policy, because an
-- audit trail a tenant can rewrite is not an audit trail. SELECT and INSERT are
-- permitted for the owning tenant; UPDATE and DELETE have no policy at all, and
-- with FORCE enabled the absence of a policy denies them outright.
--
-- organizationId is nullable (platform-level events have no tenant). Those rows
-- are invisible to tenants by the same NULL-comparison rule.
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" FORCE ROW LEVEL SECURITY;

CREATE POLICY "AuditEvent_tenant_read" ON "AuditEvent"
  FOR SELECT
  USING ("organizationId" = architech_current_org_id());

CREATE POLICY "AuditEvent_tenant_append" ON "AuditEvent"
  FOR INSERT
  WITH CHECK ("organizationId" = architech_current_org_id());

-- No UPDATE or DELETE policy: audit rows are immutable to tenants.

-- ---------------------------------------------------------------------------
-- 7. Application role
-- ---------------------------------------------------------------------------
-- The role the application connects as must not be superuser and must not hold
-- BYPASSRLS, or every policy above is decorative. This cannot be asserted
-- portably in SQL across managed providers (RDS, Neon, Supabase all differ in
-- what DDL a migration may run), so it is verified at deploy time by
-- `pnpm security:rls` instead of attempted here.
--
-- Required grants for the application role, applied by the operator:
--
--   REVOKE BYPASSRLS ON ROLE architech_app;   -- must never be granted
--   ALTER ROLE architech_app NOSUPERUSER;
--
-- The connection pool must SET app.current_org_id at checkout and RESET it at
-- release. See lib/repositories/server/tenant.ts.
