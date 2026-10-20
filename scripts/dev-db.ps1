<#
.SYNOPSIS
  Local PostgreSQL for development on native Windows (no Docker, no WSL, no admin rights).

.DESCRIPTION
  Uses the portable EnterpriseDB binaries. Data lives outside the repo.
    init    - create the cluster, roles (shop_owner / shop_app / shop_platform), databases
              (shop_dev, shop_test) and write connection strings into git-ignored .env files
    start   - start the server
    stop    - stop the server
    status  - show server status
    psql    - open psql as the superuser against shop_dev

  Overrides: SHOP_PG_HOME (binaries), SHOP_PG_ROOT (data/log/secrets), SHOP_PG_PORT.
#>
param(
  [ValidateSet('init', 'start', 'stop', 'status', 'psql')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$PgHome = if ($env:SHOP_PG_HOME) { $env:SHOP_PG_HOME } else { 'D:\devtools\pgsql-18' }
$Root = if ($env:SHOP_PG_ROOT) { $env:SHOP_PG_ROOT } else { 'D:\devtools\shopify-pg' }
$Port = if ($env:SHOP_PG_PORT) { [int]$env:SHOP_PG_PORT } else { 5432 }
$Data = Join-Path $Root 'data'
$Log = Join-Path $Root 'postgres.log'
$PwFile = Join-Path $Root 'superuser.pwd'
$Bin = Join-Path $PgHome 'bin'
$RepoRoot = Split-Path $PSScriptRoot -Parent

function New-Secret {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([Convert]::ToBase64String($bytes) -replace '[+/=]', '')
}

function Invoke-Psql([string]$Database, [string]$Sql) {
  $env:PGPASSWORD = [IO.File]::ReadAllText($PwFile)
  try {
    $Sql | & (Join-Path $Bin 'psql.exe') -h localhost -p $Port -U postgres -d $Database -v ON_ERROR_STOP=1 -q
    if ($LASTEXITCODE -ne 0) { throw "psql failed against $Database" }
  } finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
  }
}

# Replace or append KEY=value lines in a git-ignored env file, keeping other lines intact.
function Set-EnvValues([string]$File, [hashtable]$Values) {
  $lines = @()
  if (Test-Path $File) { $lines = @(Get-Content $File) }
  foreach ($key in $Values.Keys) {
    $line = "$key=$($Values[$key])"
    $index = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -match "^$key=") { $index = $i } }
    if ($index -ge 0) { $lines[$index] = $line } else { $lines += $line }
  }
  [IO.File]::WriteAllText($File, (($lines -join "`n") + "`n"))
}

function Start-Db {
  # Launch detached (shell execute) so the server does not inherit this console's output
  # handles; otherwise callers that capture output wait forever for the pipe to close.
  $psi = New-Object Diagnostics.ProcessStartInfo
  $psi.FileName = Join-Path $Bin 'pg_ctl.exe'
  $psi.Arguments = "-D `"$Data`" -l `"$Log`" -o `"-p $Port`" -w start"
  $psi.UseShellExecute = $true
  $psi.WindowStyle = 'Hidden'
  $proc = [Diagnostics.Process]::Start($psi)
  $proc.WaitForExit()
  if ($proc.ExitCode -ne 0) { throw "pg_ctl start failed; see $Log" }
  Write-Host "PostgreSQL running on localhost:$Port"
}

switch ($Action) {
  'init' {
    if (Test-Path $Data) { throw "Cluster already exists at $Data" }
    New-Item -ItemType Directory -Force $Root | Out-Null
    [IO.File]::WriteAllText($PwFile, (New-Secret))

    & (Join-Path $Bin 'initdb.exe') -D $Data -U postgres --pwfile=$PwFile --auth=scram-sha-256 -E UTF8 --no-locale
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
    Add-Content -Path (Join-Path $Data 'postgresql.conf') -Value "`nlisten_addresses = 'localhost'`nport = $Port`n"
    Start-Db

    $owner = New-Secret; $app = New-Secret; $platform = New-Secret
    Invoke-Psql 'postgres' @"
CREATE ROLE shop_owner LOGIN CREATEDB PASSWORD '$owner';
CREATE ROLE shop_app LOGIN PASSWORD '$app';
CREATE ROLE shop_platform LOGIN BYPASSRLS PASSWORD '$platform';
CREATE DATABASE shop_dev OWNER shop_owner;
CREATE DATABASE shop_test OWNER shop_owner;
"@
    foreach ($db in 'shop_dev', 'shop_test') {
      Invoke-Psql $db @"
ALTER SCHEMA public OWNER TO shop_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO shop_app, shop_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shop_app, shop_platform;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO shop_app, shop_platform;
"@
    }

    $base = "localhost:$Port"
    $values = @{
      DATABASE_URL           = "postgresql://shop_app:$app@$base/shop_dev"
      DATABASE_URL_PLATFORM  = "postgresql://shop_platform:$platform@$base/shop_dev"
      DATABASE_URL_MIGRATE   = "postgresql://shop_owner:$owner@$base/shop_dev"
      TEST_DATABASE_URL          = "postgresql://shop_app:$app@$base/shop_test"
      TEST_DATABASE_URL_PLATFORM = "postgresql://shop_platform:$platform@$base/shop_test"
      TEST_DATABASE_URL_MIGRATE  = "postgresql://shop_owner:$owner@$base/shop_test"
    }
    Set-EnvValues (Join-Path $RepoRoot 'apps\api\.env') $values
    Set-EnvValues (Join-Path $RepoRoot 'packages\db\.env') $values
    Write-Host "Initialized. Connection strings written to apps\api\.env and packages\db\.env"
  }
  'start' { Start-Db }
  'stop' { & (Join-Path $Bin 'pg_ctl.exe') -D $Data -m fast stop }
  'status' { & (Join-Path $Bin 'pg_ctl.exe') -D $Data status }
  'psql' {
    $env:PGPASSWORD = [IO.File]::ReadAllText($PwFile)
    & (Join-Path $Bin 'psql.exe') -h localhost -p $Port -U postgres -d shop_dev
  }
}
