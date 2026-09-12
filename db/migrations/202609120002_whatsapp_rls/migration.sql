-- Organization isolation for the WhatsApp control-plane tables.
--
-- There is deliberately no wildcard policy. A missing tenant GUC returns zero
-- rows and rejects writes, including for the table owner because FORCE is set.

ALTER TABLE "WhatsAppAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WhatsAppAccount_tenant_select" ON "WhatsAppAccount"
  FOR SELECT USING ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppAccount_tenant_insert" ON "WhatsAppAccount"
  FOR INSERT WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppAccount_tenant_update" ON "WhatsAppAccount"
  FOR UPDATE USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppAccount_tenant_delete" ON "WhatsAppAccount"
  FOR DELETE USING ("organizationId" = architech_current_org_id());

ALTER TABLE "WhatsAppTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WhatsAppTemplate_tenant_select" ON "WhatsAppTemplate"
  FOR SELECT USING ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppTemplate_tenant_insert" ON "WhatsAppTemplate"
  FOR INSERT WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppTemplate_tenant_update" ON "WhatsAppTemplate"
  FOR UPDATE USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppTemplate_tenant_delete" ON "WhatsAppTemplate"
  FOR DELETE USING ("organizationId" = architech_current_org_id());

ALTER TABLE "WhatsAppDispatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppDispatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY "WhatsAppDispatch_tenant_select" ON "WhatsAppDispatch"
  FOR SELECT USING ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppDispatch_tenant_insert" ON "WhatsAppDispatch"
  FOR INSERT WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppDispatch_tenant_update" ON "WhatsAppDispatch"
  FOR UPDATE USING ("organizationId" = architech_current_org_id())
  WITH CHECK ("organizationId" = architech_current_org_id());
CREATE POLICY "WhatsAppDispatch_tenant_delete" ON "WhatsAppDispatch"
  FOR DELETE USING ("organizationId" = architech_current_org_id());
