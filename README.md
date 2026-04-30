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

#### Terminale B - Frontend (Vue + Vite)

```bash
cd "/Users/(utente)/Desktop/Progetto_Prova/frontend"
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

#### Terminale B - Frontend (Vue + Vite)

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

1. Apri il frontend nel browser.
2. Clicca `Choose files` e seleziona uno o più PDF.
3. Clicca `Scan`.
4. La tabella mostra una riga per invoice (con deduplica).
5. Per ogni riga:
   - `Download PDF` scarica il documento originale
   - `Export Excel` scarica l'xlsx della singola invoice

## API disponibili

- `GET /health`
- `GET /invoices`
- `POST /invoices/scan` (multipart form-data, campo `files`)
- `GET /invoices/{id}/download`
- `GET /invoices/{id}/excel`

## Note utili

- I file caricati vengono salvati in `backend/data/invoices/`.
- Il sistema deduplica i documenti uguali per contenuto.
- Se un campo non è presente nel PDF, in UI appare `not provided`.

## Troubleshooting rapido

- Se su Windows PowerShell non si attiva il venv:
  - `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- Se il frontend mostra errore di backend non raggiungibile:
  - verifica che FastAPI sia avviato su `http://localhost:8000`
- Se lo scan fallisce:
  - controlla che `OPENAI_API_KEY` sia valorizzata in `backend/.env`
