# Enables Google sign-in for Reise (Firebase Authentication).
# 1) Opens Firebase Console → Google provider
# 2) You click Enable → Save (Web client ID is usually pre-filled)
# 3) Optionally redeploy frontend with Firebase env vars

$ErrorActionPreference = "Stop"
$Project = "homey-376215"
$FrontendUrl = "https://reise-frontend-624978663833.europe-north1.run.app"
$AuthUrl = "https://console.firebase.google.com/project/$Project/authentication/providers"
$CredUrl = "https://console.cloud.google.com/apis/credentials?project=$Project"

Write-Host ""
Write-Host "=== Reise: Google-innlogging ===" -ForegroundColor Cyan
Write-Host "1) Firebase Authentication apnes i nettleseren."
Write-Host "2) Velg Google -> Enable -> Save."
Write-Host "   (Web client ID fylles vanligvis automatisk.)"
Write-Host "3) Authorized domains er allerede satt (localhost + Cloud Run)."
Write-Host ""
Write-Host "Firebase Auth: $AuthUrl"
Write-Host "Credentials:   $CredUrl"
Write-Host "Frontend:      $FrontendUrl"
Write-Host ""

Start-Process $AuthUrl

Write-Host "Trykk Enter nar Google-innlogging er Enabled og lagret i Firebase..."
[void][System.Console]::ReadLine()

$env:VITE_FIREBASE_API_KEY = "AIzaSyCKdF6f1wTrrDqCeti7NLKZ6QQ6ZnoUebg"
$env:VITE_FIREBASE_AUTH_DOMAIN = "homey-376215.firebaseapp.com"
$env:VITE_FIREBASE_PROJECT_ID = "homey-376215"
$env:VITE_FIREBASE_APP_ID = "1:624978663833:web:650e2ae3a61736055d5b08"

$redeploy = Read-Host "Vil du rulle ut frontend til Cloud Run na? (j/N)"
if ($redeploy -match '^[jJyY]') {
  $Root = Split-Path -Parent $PSScriptRoot
  if (-not $PSScriptRoot) { $Root = "C:\Arkiv\Utvikling\Reise" }
  $BackendUrl = "https://reise-backend-624978663833.europe-north1.run.app"
  $buildVars = "VITE_API_URL=$BackendUrl/api,VITE_FIREBASE_API_KEY=$($env:VITE_FIREBASE_API_KEY),VITE_FIREBASE_AUTH_DOMAIN=$($env:VITE_FIREBASE_AUTH_DOMAIN),VITE_FIREBASE_PROJECT_ID=$($env:VITE_FIREBASE_PROJECT_ID),VITE_FIREBASE_APP_ID=$($env:VITE_FIREBASE_APP_ID)"
  Write-Host "Deployer reise-frontend..."
  gcloud run deploy reise-frontend `
    --source "$Root\frontend" `
    --region europe-north1 `
    --allow-unauthenticated `
    --quiet `
    --set-build-env-vars="$buildVars"
  Write-Host "Ferdig: $FrontendUrl" -ForegroundColor Green
} else {
  Write-Host "Hoppet over deploy. Lokalt: start frontend pa nytt (npm run dev)." -ForegroundColor Yellow
}
