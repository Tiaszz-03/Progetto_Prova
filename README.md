# Customs Document Processing System

Sistema full-stack per:
- upload/scansione di PDF invoice
- estrazione dati strutturati con OpenAI
- visualizzazione in tabella
- download PDF originale + export Excel per riga

## Requisiti

- macOS, Linux o Windows
- Python 3.10+
- Node.js 18+
- npm

## Configurazione

### 1) API key OpenAI

Nel file `backend/.env` imposta:

```env
OPENAI_API_KEY=your_openai_api_key
```

## Avvio rapido (2 terminali)

### macOS / Linux

#### Terminale A - Backend (FastAPI)

```bash
cd "/Users/(utente)/Desktop/Progetto_Prova/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Terminale B - Frontend (React + Vite + Tailwind, UI tipo FreightAgent)

```bash
cd "/Users/(utente)/Desktop/Progetto_Prova/frontend"
cp .env.example .env   # opzionale: imposta VITE_API_BASE_URL se il backend non è su :8000
npm install
npm run dev
```

### Windows (PowerShell)

#### Terminale A - Backend (FastAPI)

```powershell
cd "C:\path\to\Progetto_Prova\backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Terminale B - Frontend (React + Vite)

```powershell
cd "C:\path\to\Progetto_Prova\frontend"
npm install
npm run dev
```

### Windows (cmd)

Attivazione virtualenv backend:

```bat
.venv\Scripts\activate.bat
```

Backend disponibile su `http://localhost:8000`  
Health check: `http://localhost:8000/health`

Frontend disponibile di default su `http://localhost:5173`

## Come funziona l'app (flow attuale)

1. Apri il frontend nel browser (`http://localhost:5173`).
2. Nella sidebar trovi:
   - **Shipments**: dashboard con risultati estratti
   - **Documents**: elenco dei PDF sorgente apribili in nuova tab
3. In **Shipments**, clicca **+ New Shipment**:
   - si apre il pannello con i documenti disponibili
   - seleziona uno o più file PDF
   - il bottone verde **Start GPT Scan** resta disabilitato finché non selezioni almeno un file
4. Clicca **Start GPT Scan**:
   - il frontend legge i PDF dalla cartella `backend/files/`
   - invia i file al backend (`POST /invoices/scan`)
   - il backend estrae i dati con OpenAI e salva i PDF in `backend/files/invoices/`
5. Al termine della scansione:
   - la tabella in dashboard mostra i record estratti
   - se non c'è nessuna scansione, appare il messaggio:
     `No documents have been scanned yet. Please select and scan at least one document to see the outcome.`
6. Aprendo una riga (freccia a destra) vai nel dettaglio shipment, dove il bottone **Export Report** scarica l'Excel di quel record (`GET /invoices/{id}/excel`).

## API disponibili

- `GET /health`
- `GET /invoices`
- `GET /invoices/{id}`
- `POST /invoices/scan` (multipart form-data, campo `files`)
- `GET /invoices/{id}/download`
- `GET /invoices/{id}/excel`

## Deploy automatico (main -> Firebase Hosting + Firebase Functions)

Deploy unificato su Firebase con un solo workflow:

- `/.github/workflows/deploy-firebase.yml`
  - trigger su push in `main` quando cambia `frontend/**`, `backend/**` o file di config Firebase
  - builda il frontend (`frontend/dist`)
  - deploya `hosting` + `functions` con `firebase deploy --only hosting,functions`

### Secrets GitHub necessari

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT` (JSON service account con permessi Firebase deploy)
- `OPENAI_API_KEY` (scritta in `backend/.env` durante la pipeline)
- `GEMINI_API_KEY` (se usata dal frontend)

### Config Firebase

- `firebase.json` in root:
  - Hosting pubblica `frontend/dist`
  - rewrite `/api/**` -> Function `api` (`europe-west1`)
  - rewrite SPA `**` -> `/index.html`
- `.firebaserc` in root:
  - project default (aggiorna l'id se diverso dal tuo)

## Note utili

- I PDF sorgente usati dal frontend sono in `backend/files/`.
- `frontend/vite.config.ts` usa `publicDir: "../backend/files"` per servire quei PDF in locale.
- I file scansionati vengono salvati in `backend/files/invoices/`.
- In Firebase Functions i file caricati vengono salvati in `/tmp/invoices` (storage temporaneo dell'istanza).
- Il sistema deduplica i documenti uguali per contenuto.
- UI allineata al progetto di riferimento in `freight-forwarding-operation-agent/` (React + Tailwind v4).

## Troubleshooting rapido

- Se su Windows PowerShell non si attiva il venv:
  - `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Se il frontend mostra errore di backend non raggiungibile:
  - verifica che FastAPI sia avviato su `http://localhost:8000`
- Se lo scan fallisce:
  - controlla che `OPENAI_API_KEY` sia valorizzata in `backend/.env`
- Se vedi ancora righe "vecchie" in dashboard:
  - svuota `backend/files/invoices/` e riavvia backend
- Se un PDF non si apre in **Documents**:
  - verifica che il file esista davvero in `backend/files/` con lo stesso nome mostrato in UI
