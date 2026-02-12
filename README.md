# Prenotazione posti teatro

Applicazione web per prenotare i posti a sedere per uno spettacolo. Gli utenti vedono la piantina, selezionano i posti (con blocco temporaneo 5 min), inseriscono nome ed email e confermano. Il pagamento avviene sul posto.

## Requisiti

- Python 3.9–3.12 (consigliato; con Python 3.13 usare `pip install -r requirements.txt` con SQLAlchemy aggiornato)
- Node.js 18+ (per il frontend)

## Docker (consigliato)

Con Docker e Docker Compose puoi avviare tutto con un solo comando:

```bash
docker compose up --build
```

Poi apri **http://localhost:8080**. Il backend è in ascolto sulla porta 5000 (interno); il frontend (nginx) espone la porta 8080 e inoltra le richieste `/api` al backend. Il database SQLite è persistente nel volume `backend-data`. Per variabili d’ambiente (es. `ADMIN_PASSWORD`, `SECRET_KEY`) crea un file `.env` nella root o passale a `docker compose`.

## Backend

### Setup con virtualenv (consigliato)

```bash
# Crea virtualenv (se non esiste già)
python -m venv .venv

# Attiva virtualenv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Windows CMD:
# .venv\Scripts\activate.bat
# Linux/Mac:
# source .venv/bin/activate

# Installa dipendenze
pip install -r backend/requirements.txt

# Avvia server
cd backend
python run.py
```

### Setup senza virtualenv

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Il server è su http://127.0.0.1:5000. La prima esecuzione crea il database SQLite e popola i posti (teatro medio: ~15 file, 8-12 posti per fila).

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Apri http://localhost:5173. Le richieste API sono in proxy su http://127.0.0.1:5000 (configurabile in `vite.config.ts`).

## Test

### Backend (pytest)

```bash
# Dalla root, con virtualenv attivo
pip install -r backend/requirements-dev.txt
cd backend
pytest
```

Oppure dalla root: `pytest backend/`

I test usano un database SQLite in-memory (`TESTING=1`).

### Frontend (Vitest + React Testing Library)

```bash
cd frontend
npm install
npm run test
```

Per una singola esecuzione: `npm run test:run`

## Piantina

Inserisci la tua piantina come immagine in `frontend/public/piantina.png`. Se il file non c’è, la griglia dei posti viene comunque mostrata su sfondo scuro.

## Admin

Clic su **Admin** in alto a destra. Password predefinita: `admin123` (impostabile con variabile d’ambiente `ADMIN_PASSWORD`). Da qui puoi marcare intere file come "riservate staff" (non prenotabili).

## Blocco temporaneo

Quando un utente clicca su un posto, il posto viene bloccato per 5 minuti per la sua sessione. Altri utenti lo vedono come "In prenotazione" (arancione) e non possono selezionarlo. Il timer si rinnova a ogni click e a ogni digitazione nel form. Dopo 5 minuti di inattività i blocchi scadono e i posti tornano disponibili.
