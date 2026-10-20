<#
.SYNOPSIS
  Restores a custom-format dump into a database.

.DESCRIPTION
  Safe by default: refuses to touch an existing database. Pass -Replace to DROP and recreate the
  target (destructive — all current data in it is lost). Roles (shop_owner / shop_app /
  shop_platform) are cluster-wide and must already exist (scripts\dev-db.ps1 init).

.EXAMPLE
  .\scripts\restore-db.ps1 -File D:\devtools\shopify-backups\shop_dev-20261019-120000.dump -Target shop_restore_drill
#>
param(
  [Parameter(Mandatory = $true)][string]$File,
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$Replace
)

$ErrorActionPreference = 'Stop'
$PgHome = if ($env:SHOP_PG_HOME) { $env:SHOP_PG_HOME } else { 'D:\devtools\pgsql-18' }
$Root = if ($env:SHOP_PG_ROOT) { $env:SHOP_PG_ROOT } else { 'D:\devtools\shopify-pg' }
$Port = if ($env:SHOP_PG_PORT) { [int]$env:SHOP_PG_PORT } else { 5432 }
$Bin = Join-Path $PgHome 'bin'
if (-not (Test-Path $File)) { throw "Backup not found: $File" }
if ($Target -notmatch '^[a-z_][a-z0-9_]{0,62}$') { throw "Invalid database name: $Target" }

function Psql([string]$Sql) {
  $out = $Sql | & (Join-Path $Bin 'psql.exe') -h localhost -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -At
  if ($LASTEXITCODE -ne 0) { throw 'psql failed' }
  return $out
}

$env:PGPASSWORD = [IO.File]::ReadAllText((Join-Path $Root 'superuser.pwd'))
try {
  $exists = Psql "SELECT 1 FROM pg_database WHERE datname = '$Target';"
  if ($exists) {
    if (-not $Replace) { throw "Database '$Target' exists. Re-run with -Replace to drop and recreate it." }
    Psql "DROP DATABASE `"$Target`" WITH (FORCE);" | Out-Null
  }
  Psql "CREATE DATABASE `"$Target`" OWNER shop_owner;" | Out-Null

  & (Join-Path $Bin 'pg_restore.exe') -h localhost -p $Port -U postgres -d $Target --exit-on-error $File
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed' }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
Write-Host "Restored $File into $Target"
