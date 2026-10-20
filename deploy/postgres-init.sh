#!/bin/sh
# Creates the three database roles (see ADR 0003) on first start of the Postgres container.
set -eu
psql -v ON_ERROR_STOP=1 --username postgres <<SQL
CREATE ROLE shop_owner LOGIN PASSWORD '${SHOP_OWNER_PASSWORD}';
CREATE ROLE shop_app LOGIN PASSWORD '${SHOP_APP_PASSWORD}';
CREATE ROLE shop_platform LOGIN BYPASSRLS PASSWORD '${SHOP_PLATFORM_PASSWORD}';
CREATE DATABASE shop OWNER shop_owner;
\connect shop
ALTER SCHEMA public OWNER TO shop_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO shop_app, shop_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shop_app, shop_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO shop_app, shop_platform;
SQL
