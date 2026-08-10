# Reise

Reiseplanlegger med dag-for-dag-plan, hotell-lenker og tidslinje. Go API + React/Vite mot Firestore (samme Firebase-prosjekt som beer-appen).

## Oppsett

### Credentials

Pek på samme service account som beer-appen (anbefalt — ingen ekstra kopi):

```powershell
cd backend\api
$env:FIREBASE_KEY_PATH = "C:\Arkiv\Utvikling\Antigravity\beer\backend\api\service-account.json"
$env:PORT = "8082"
go run .
```

Eller kopier nøkkelen lokalt (gitignorert):

```powershell
copy ..\Antigravity\beer\backend\api\service-account.json backend\api\service-account.json
cd backend\api
go run .
```

### Backend

API lytter på port `8082` (eller `PORT`). Health: `GET /api/health`.

Hvis `8082` er opptatt, bruk f.eks. `$env:PORT = "8083"` og sett samme port i `frontend/.env.local` (`VITE_API_URL`).

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Åpne Vite-URL-en (typisk `http://localhost:5173`). API-kall går til `http://localhost:8082/api` via `VITE_API_URL` (se `.env.example`).

## Firestore

Collections i prosjektet `homey-376215`:

- `trips` — reiser
- `trip_days` — dager knyttet til en tur via `tripId`

## Google-innlogging

Firebase Auth er koblet til prosjektet `homey-376215`. Innlogging huskes i nettleseren (`browserLocalPersistence`) til du logger ut.

**Én gang — aktiver Google som innloggingsmetode:**

1. Åpne [Firebase Authentication → Sign-in method](https://console.firebase.google.com/project/homey-376215/authentication/providers)
2. **Google** → **Enable** → **Save** (Web client ID er vanligvis forhåndsutfylt)

Eller kjør:

```powershell
powershell -File scripts/setup-google-auth.ps1
```

Lokalt ligger Firebase-config i `frontend/.env.local` (gitignorert). Cloud Run-deploy bakker den inn automatisk.

Google Drive API er aktivert for «Lagre i Mine kart».

## Cloud Run

Deploy API + frontend til `homey-376215` / `europe-north1`:

```bash
bash scripts/deploy-cloud-run.sh
```

Tjenester: `reise-backend`, `reise-frontend`. Backend bruker Application Default Credentials med `FIREBASE_PROJECT_ID=homey-376215`.

Valgfritt: `VITE_GOOGLE_CLIENT_ID=... bash scripts/deploy-cloud-run.sh`
