# Prenotazione posti teatro

Applicazione web per prenotare i posti a sedere per uno spettacolo. Gli utenti vedono la piantina, selezionano i posti (con blocco temporaneo 5 min), inseriscono nome ed email e confermano. Il pagamento avviene sul posto.

## Requisiti

- Python 3.9–3.12 (consigliato; con Python 3.13 usare `pip install -r requirements.txt` con SQLAlchemy aggiornato)
- Node.js 18+ (per il frontend)

## Avvio in locale (un solo comando)

Dalla **root del progetto** puoi avviare backend e frontend insieme:

```bash
npm run dev
```

Requisiti: virtualenv con dipendenze backend già installate (`pip install -r backend/requirements.txt`), e `npm install` nella root (installa `concurrently`). Poi apri **http://localhost:5173** per il frontend; il backend risponde su http://127.0.0.1:5000.

## Docker (consigliato)

Con Docker e Docker Compose puoi avviare tutto con un solo comando:

```bash
docker compose up --build
```

Poi apri **http://localhost:8080**. Il backend è in ascolto sulla porta 5000 (interno); il frontend (nginx) espone la porta 8080 e inoltra le richieste `/api` al backend. Il database SQLite è persistente nel volume `backend-data`. Per variabili d’ambiente (es. `ADMIN_PASSWORD`, `SECRET_KEY`) crea un file `.env` nella root o passale a `docker compose`.

## Deploy su Railway

Puoi pubblicare l'app su [Railway](https://railway.com) con due servizi (backend + frontend) dallo stesso repository.

1. **Crea un progetto** su Railway e collegalo al repo GitHub.

2. **Servizio Backend**
   - Aggiungi un servizio da GitHub, imposta **Root Directory** = `backend`.
   - Railway userà il `Dockerfile` nella cartella backend.
   - **Variabili d'ambiente**: `DATABASE_URL=sqlite:////app/data/database.db`, `SECRET_KEY` (stringa casuale, es. `openssl rand -hex 32`), `ADMIN_PASSWORD`, `ALLOWED_ORIGINS` = URL pubblico del frontend (es. `https://tuoprogetto-frontend.up.railway.app`).
   - **Volume**: crea un volume e montalo su `/app/data` per persistere il database SQLite.
   - In **Settings → Networking** genera un dominio pubblico e annota l'URL (es. `https://tuoprogetto-backend.up.railway.app`).

3. **Servizio Frontend**
   - Aggiungi un secondo servizio dallo stesso repo, **Root Directory** = `frontend`.
   - **Variabile d'ambiente**: `BACKEND_URL` = URL pubblico del backend (es. `https://tuoprogetto-backend.up.railway.app`, senza slash finale).
   - In **Settings → Networking** genera un dominio pubblico per il frontend.

4. **CORS**: nel backend, `ALLOWED_ORIGINS` deve includere l'URL del frontend (con `https://`). Railway fornisce TLS sui domini `.up.railway.app`.

Dopo il primo deploy, ogni push sul branch collegato triggera il redeploy. Per dati di esempio sul DB in produzione puoi usare gli script del backend (es. `seed_example_data.py`) tramite Railway CLI o un job one-off.

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

### Dati di esempio

Per inserire nel DB impostazioni di esempio (Teatro Verdi, spettacolo, gruppi Platea/Galleria) e alcune prenotazioni fittizie:

```bash
cd backend
python seed_example_data.py
```

Lo script aggiorna sempre le impostazioni; crea i posti solo se la tabella è vuota e aggiunge prenotazioni solo se non ne esistono già. Utile per provare l’app senza configurare tutto a mano.

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

### Test E2E (Playwright)

I test end-to-end verificano il flusso completo in browser (selezione posti, form, conferma, recupero). Richiedono che **backend e frontend siano avviati**.

1. Avvia il **backend** sulla porta 5000 (es. `cd backend && python run.py`).
2. Dalla cartella **frontend**: `npm run e2e` (avvia automaticamente il dev server su http://localhost:5173 se non è già in esecuzione, poi esegue i test).
3. Per debug con interfaccia: `npm run e2e:ui`.

Al primo utilizzo installa i browser Playwright: `npx playwright install`.

## Piantina

Inserisci la tua piantina come immagine in `frontend/public/piantina.png`. Se il file non c’è, la griglia dei posti viene comunque mostrata su sfondo scuro.

## Admin

Clic su **Admin** in alto a destra. Password predefinita: `admin123` (impostabile con variabile d’ambiente `ADMIN_PASSWORD`). Da qui puoi marcare intere file come "riservate staff" (non prenotabili).

## Blocco temporaneo

Quando un utente clicca su un posto, il posto viene bloccato per 5 minuti per la sua sessione. Altri utenti lo vedono come "In prenotazione" (arancione) e non possono selezionarlo. Il timer si rinnova a ogni click e a ogni digitazione nel form. Dopo 5 minuti di inattività i blocchi scadono e i posti tornano disponibili.
