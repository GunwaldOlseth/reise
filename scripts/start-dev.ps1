# Start Reise locally (Windows PowerShell).
# Backend :8082  Frontend :5174  (beer/brygge uses 5173)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "frontend\package.json"))) {
  throw "Fant ikke frontend\package.json. Kjør fra reise-repoet: powershell -File scripts\start-dev.ps1"
}

$BeerKey = "C:\Arkiv\Utvikling\Antigravity\beer\backend\api\service-account.json"
$LocalKey = Join-Path $Root "backend\api\service-account.json"
$KeyPath = if (Test-Path $BeerKey) { $BeerKey } elseif (Test-Path $LocalKey) { $LocalKey } else { $BeerKey }

function Get-ListenerPid([int]$Port) {
  $hit = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
  if ($hit) { return [int]$hit }
  return $null
}

Write-Host ""
Write-Host "=== Reise lokal dev ===" -ForegroundColor Cyan
Write-Host "Repo:      $Root"
Write-Host "Frontend:  http://localhost:5174/   (ikke 5173)"
Write-Host "Backend:   http://localhost:8082/api/health"
Write-Host "Backend bruker samme Firestore som produksjon (ikke emulator)."
Write-Host "Vite-dev kaller /api (proxy til :8082)."
Write-Host ""

$envLocal = Join-Path $Root "frontend\.env.local"
if (Test-Path $envLocal) {
  $localApi = Select-String -Path $envLocal -Pattern "VITE_API_URL\s*=" -ErrorAction SilentlyContinue
  if ($localApi -and $localApi.Line -match "run\.app") {
    Write-Host "Merk: frontend\.env.local har Cloud Run VITE_API_URL." -ForegroundColor Yellow
    Write-Host "npm run dev ignorerer den og bruker /api -> :8082. Fjern VITE_API_URL fra .env.local om du vil." -ForegroundColor Yellow
    Write-Host ""
  }
}

$fePid = Get-ListenerPid 5174
$bePid = Get-ListenerPid 8082
if ($fePid) {
  Write-Host "Port 5174 er opptatt (PID $fePid) — stopper den..." -ForegroundColor Yellow
  Stop-Process -Id $fePid -Force -ErrorAction SilentlyContinue
}
if ($bePid) {
  Write-Host "Port 8082 er opptatt (PID $bePid) — stopper den..." -ForegroundColor Yellow
  Stop-Process -Id $bePid -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

if (-not (Test-Path $KeyPath)) {
  Write-Host "Advarsel: Fant ikke service-account.json:" -ForegroundColor Yellow
  Write-Host "  $KeyPath"
  Write-Host "Backend vil feile uten FIREBASE_KEY_PATH."
  Write-Host ""
}

$backendCmd = @"
`$host.UI.RawUI.WindowTitle = 'Reise backend :8082'
Set-Location '$Root\backend\api'
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
if (Test-Path '$KeyPath') { `$env:FIREBASE_KEY_PATH = '$KeyPath' }
`$env:PORT = '8082'
Write-Host 'Starter backend mot produksjons-Firestore (ingen emulator).'
go run .
Write-Host 'Backend avsluttet. Les feilmeldingen over.' -ForegroundColor Red
Read-Host 'Enter for a lukke'
"@

$frontendCmd = @"
`$host.UI.RawUI.WindowTitle = 'Reise frontend :5174'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
Set-Location '$Root\frontend'
# npm.ps1 is blocked when ExecutionPolicy is Restricted; npm.cmd is not.
if (-not (Test-Path node_modules)) { npm.cmd install }
Write-Host 'Starter Vite. Vent til du ser Local: http://localhost:5174/'
npm.cmd run dev
Write-Host 'Frontend avsluttet. Ofte: port 5174 opptatt, eller kjort fra feil mappe.' -ForegroundColor Red
Read-Host 'Enter for a lukke'
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "To PowerShell-vinduer er apnet."
Write-Host "Nar Vite viser Local: http://localhost:5174/ apnes nettleseren."
Write-Host ""

$ok = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:5174/" -UseBasicParsing -TimeoutSec 1
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
}

if ($ok) {
  Start-Process "http://localhost:5174/"
  Write-Host "OK — apnet http://localhost:5174/" -ForegroundColor Green
} else {
  Write-Host "Vite svarte ikke pa :5174. Se vinduet «Reise frontend :5174» for feil." -ForegroundColor Red
  Write-Host "Vanlig: 'Port 5174 is already in use' eller 'go' / 'npm' mangler i PATH."
}
