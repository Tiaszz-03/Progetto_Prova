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

## Come usare l'app

1. Apri il frontend nel browser (`http://localhost:5173`).
2. Clicca **+ New Shipment** (in alto a destra), seleziona uno o più PDF: vengono inviati al backend e analizzati.
3. Nella dashboard vedi una riga per documento (deduplica lato backend); apri il dettaglio con la freccia.
4. Nel dettaglio puoi usare ancora i passi demo con **Gemini** (opzionale: `GEMINI_API_KEY` in `frontend/.env`) per simulazioni; i dati estratti da PDF arrivano dall’API FastAPI.

## API disponibili

- `GET /health`
- `GET /invoices`
- `GET /invoices/{id}`
- `POST /invoices/scan` (multipart form-data, campo `files`)
- `GET /invoices/{id}/download`
- `GET /invoices/{id}/excel`

## Note utili

- I file caricati vengono salvati in `backend/data/invoices/`.
- Il sistema deduplica i documenti uguali per contenuto.
- UI allineata al progetto di riferimento in `freight-forwarding-operation-agent/` (React + Tailwind v4).

## Troubleshooting rapido

- Se su Windows PowerShell non si attiva il venv:
  - `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Se il frontend mostra errore di backend non raggiungibile:
  - verifica che FastAPI sia avviato su `http://localhost:8000`
- Se lo scan fallisce:
  - controlla che `OPENAI_API_KEY` sia valorizzata in `backend/.env`
