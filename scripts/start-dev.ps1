# Start Reise locally (Windows PowerShell).
# Opens two terminals: backend (8082) + frontend (5174).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not (Test-Path (Join-Path $Root "frontend\package.json"))) {
  $Root = Split-Path -Parent $PSScriptRoot
}

$BeerKey = "C:\Arkiv\Utvikling\Antigravity\beer\backend\api\service-account.json"
$LocalKey = Join-Path $Root "backend\api\service-account.json"
$KeyPath = if (Test-Path $BeerKey) { $BeerKey } elseif (Test-Path $LocalKey) { $LocalKey } else { $BeerKey }

Write-Host ""
Write-Host "=== Reise lokal dev ===" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5174/  (ikke 5173)"
Write-Host "Backend:  http://localhost:8082/api/health"
Write-Host ""

if (-not (Test-Path $KeyPath)) {
  Write-Host "Advarsel: Fant ikke service-account.json pa:" -ForegroundColor Yellow
  Write-Host "  $KeyPath"
  Write-Host "Backend vil feile uten FIREBASE_KEY_PATH. Kopier nokkel eller oppdater stien i dette scriptet."
  Write-Host ""
}

$backendCmd = @"
cd '$Root\backend\api'
`$env:FIREBASE_KEY_PATH = '$KeyPath'
`$env:PORT = '8082'
go run .
"@

$frontendCmd = @"
cd '$Root\frontend'
if (-not (Test-Path node_modules)) { npm install }
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "Apner to PowerShell-vinduer. Vent til Vite viser Local: http://localhost:5174/" -ForegroundColor Green
