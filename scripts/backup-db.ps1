<#
.SYNOPSIS
  Backs up a PostgreSQL database to a compressed custom-format dump and prunes old backups.

.EXAMPLE
  .\scripts\backup-db.ps1                       # shop_dev -> D:\devtools\shopify-backups
  .\scripts\backup-db.ps1 -Database shop_dev -Keep 30

.NOTES
  The dump is verified with `pg_restore --list` before old backups are pruned. Store copies of
  backups off the machine (object storage) in production; see docs/runbook.md.
#>
param(
  [string]$Database = 'shop_dev',
  [string]$OutDir = 'D:\devtools\shopify-backups',
  [int]$Keep = 14
)

$ErrorActionPreference = 'Stop'
$PgHome = if ($env:SHOP_PG_HOME) { $env:SHOP_PG_HOME } else { 'D:\devtools\pgsql-18' }
$Root = if ($env:SHOP_PG_ROOT) { $env:SHOP_PG_ROOT } else { 'D:\devtools\shopify-pg' }
$Port = if ($env:SHOP_PG_PORT) { [int]$env:SHOP_PG_PORT } else { 5432 }
$Bin = Join-Path $PgHome 'bin'

New-Item -ItemType Directory -Force $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $OutDir "$Database-$stamp.dump"

$env:PGPASSWORD = [IO.File]::ReadAllText((Join-Path $Root 'superuser.pwd'))
try {
  & (Join-Path $Bin 'pg_dump.exe') -h localhost -p $Port -U postgres -d $Database -Fc -Z 6 -f $file
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed for $Database" }

  $entries = & (Join-Path $Bin 'pg_restore.exe') --list $file
  if ($LASTEXITCODE -ne 0 -or $entries.Count -lt 10) { throw "Backup verification failed: $file" }
} finally {
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

$size = [math]::Round((Get-Item $file).Length / 1KB, 1)
Write-Host "Backup OK: $file ($size KB, $($entries.Count) TOC entries)"

Get-ChildItem $OutDir -Filter "$Database-*.dump" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Keep |
  ForEach-Object { Remove-Item $_.FullName; Write-Host "Pruned $($_.Name)" }
