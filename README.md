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

### GitHub Actions

Push til `master` deployer automatisk til Cloud Run når relevante filer endres:

| Workflow | Trigger (paths) | Tjeneste |
| --- | --- | --- |
| `deploy-backend.yml` | `backend/**` | `reise-backend` |
| `deploy-frontend.yml` | `frontend/**` | `reise-frontend` |

Begge kan også kjøres manuelt under **Actions → Run workflow**.

**Repository secret (påkrevd):** `GCP_SA_KEY` — JSON-nøkkel for service account med rettigheter til Cloud Run og Cloud Build (f.eks. `deploy-app@homey-376215.iam.gserviceaccount.com`).

Engangsoppsett (lokalt, med `gh` innlogget):

```bash
bash scripts/setup-github-actions.sh path/to/deploy-app-key.json --trigger
```

Alternativt: **Settings → Secrets and variables → Actions → New repository secret** → navn `GCP_SA_KEY`, verdi = hele JSON-filen.

Eksisterende miljøvariabler på backend (`ADMIN_PASSWORD`, `BACKUP_CRON_SECRET`, …) blir ikke fjernet; workflowen oppdaterer bare `FIREBASE_PROJECT_ID`.

## Sikkerhetskopi (Cloud Storage + Scheduler)

Ingen nye tabeller. Firestore dumpes som JSON-filer til `gs://homey-376215-reise-backups/backups/` kl. **08, 14 og 19** (Europe/Oslo).

```bash
bash scripts/setup-backup-scheduler.sh
```

Scriptet lager bucket, setter `BACKUP_BUCKET`, `BACKUP_CRON_SECRET` og `ADMIN_PASSWORD` på `reise-backend`, og oppretter tre Cloud Scheduler-jobber.

Lokalt (uten bucket): sett `ADMIN_PASSWORD` og ta backup til mappen `backend/api/backups`.

I appen: **Innstillinger → Admin · sikkerhetskopi** — logg inn med admin-passordet og hent en kopi tilbake.
