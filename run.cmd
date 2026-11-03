@echo off
rem One-click local run. See RUN.md.
rem   run.cmd            start everything (database, migrations, build, 3 servers), open browser
rem   run.cmd nobuild    same, but reuse the existing build
rem   run.cmd stop       close the 3 server windows (the database keeps running)
setlocal
cd /d "%~dp0"

set "API_PORT=4000"
set "ADMIN_PORT=3101"
set "STORE_PORT=3200"
rem Port 3100 is used by another project on this machine, so the admin runs on 3101.
rem Real environment variables win over the values in apps\api\.env and .env.local.
set "ADMIN_PUBLIC_URL=http://localhost:%ADMIN_PORT%"
set "CORS_ORIGINS=http://localhost:%ADMIN_PORT%,http://localhost:%STORE_PORT%"

if /i "%~1"=="stop" goto stop

if not exist "apps\api\.env" (
  echo apps\api\.env is missing. Do the first-time setup in RUN.md.
  goto fail
)

for %%P in (%API_PORT% %ADMIN_PORT% %STORE_PORT%) do (
  netstat -ano | findstr /r /c:":%%P .*LISTENING" >nul && (
    echo Port %%P is already in use. Run "run.cmd stop", or close whatever is using it.
    goto fail
  )
)

echo [1/4] Database
netstat -ano | findstr /r /c:":5432 .*LISTENING" >nul || (
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\dev-db.ps1 start
)
netstat -ano | findstr /r /c:":5432 .*LISTENING" >nul || (
  echo PostgreSQL did not start. See D:\devtools\shopify-pg\postgres.log
  goto fail
)

echo [2/4] Migrations
call pnpm --filter @repo/db migrate:deploy || goto fail

if /i "%~1"=="nobuild" (
  echo [3/4] Build skipped
) else (
  echo [3/4] Build ^(fast when nothing changed^)
  call pnpm build || goto fail
)

echo [4/4] Starting servers
start "Shop API" /d apps\api cmd /k node dist\main.js
start "Shop Admin" /d apps\admin cmd /k pnpm exec next start --port %ADMIN_PORT%
start "Shop Storefront" /d apps\storefront cmd /k pnpm exec next start --port %STORE_PORT%

call :wait "http://localhost:%API_PORT%/api/v1/health" API || goto fail
call :wait "http://localhost:%ADMIN_PORT%/" Admin || goto fail
call :wait "http://localhost:%STORE_PORT%/" Storefront || goto fail

echo.
echo   Marketing site  http://localhost:%STORE_PORT%
echo   Demo store      http://demo.localhost:%STORE_PORT%
echo   Merchant admin  http://localhost:%ADMIN_PORT%
echo   API docs        http://localhost:%API_PORT%/api/docs
echo.
echo   Login: merchant@example.com / merchant-password-123
echo   Stop:  run.cmd stop
echo.
if not defined RUN_NO_BROWSER (
  start "" "http://localhost:%STORE_PORT%"
  start "" "http://localhost:%ADMIN_PORT%"
)
exit /b 0

:wait
for /l %%I in (1,1,60) do (
  curl -s -o nul --max-time 2 "%~1" && (
    echo   %~2 is up
    exit /b 0
  )
  ping -n 3 127.0.0.1 >nul
)
echo   %~2 did not respond at %~1. Check its window for the error.
exit /b 1

:stop
rem Next.js renames its window, so find servers by port. Only this app's processes are stopped.
powershell -NoProfile -Command "foreach ($p in %API_PORT%,%ADMIN_PORT%,%STORE_PORT%) { Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | ForEach-Object { $c = (Get-CimInstance Win32_Process -Filter \"ProcessId=$($_.OwningProcess)\").CommandLine; if ($c -match 'dist.main\.js|next') { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } else { Write-Host \"Port $p is used by another program, left running.\" } } }"
ping -n 2 127.0.0.1 >nul
for %%T in ("Shop API" "Shop Admin" "Shop Storefront") do (
  taskkill /f /t /fi "WINDOWTITLE eq %%~T*" >nul 2>&1
)
echo Servers stopped.
exit /b 0

:fail
echo.
echo Run failed. See the message above.
pause
exit /b 1
