-- Row-level security for tenant-owned tables (docs/tenant-isolation.md, layer 3).
--
-- The API connects as `shop_app` (no BYPASSRLS). Each tenant transaction runs
-- `set_config('app.store_id', <uuid>, true)`; without it, tenant tables return no rows.

CREATE OR REPLACE FUNCTION app_current_store_id() RETURNS uuid
  LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.store_id', true), '')::uuid $$;

-- Enables + forces RLS and adds the standard tenant policy on a table with a "storeId" column.
CREATE OR REPLACE FUNCTION app_enable_tenant_rls(target regclass) RETURNS void
  LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', target);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', target);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s USING ("storeId" = app_current_store_id()) '
    'WITH CHECK ("storeId" = app_current_store_id())',
    target
  );
END
$$;

SELECT app_enable_tenant_rls('"AuditLog"');

-- Audit logs are append-only for the application role.
REVOKE UPDATE, DELETE ON "AuditLog" FROM shop_app;
