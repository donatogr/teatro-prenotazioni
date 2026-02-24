# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Theater seat reservation app ("Prenotazione posti Teatro") with a Flask/Python backend (port 5000, SQLite) and a React/Vite/TypeScript frontend (port 5173). See root `package.json` for dev scripts.

### Running the app

- `npm run dev` from the workspace root starts both backend and frontend via `concurrently`.
- Alternatively, run them separately: `npm run dev:backend` and `npm run dev:frontend`.
- The root script uses `python` (not `python3`). If the system only has `python3`, create a symlink: `sudo ln -s /usr/bin/python3 /usr/local/bin/python`.

### Testing

| Scope | Command | Working directory |
|-------|---------|-------------------|
| Backend unit tests | `python3 -m pytest tests/ -v` | `backend/` |
| Frontend unit tests | `npx vitest run` | `frontend/` |
| Frontend build/type-check | `npx vite build` | `frontend/` |
| E2E tests (Playwright) | `npx playwright test` | `frontend/` (requires `npx playwright install` first) |

### Non-obvious notes

- `tsc -b` reports 2 pre-existing type errors in `src/services/api.test.ts`; these do not affect vitest or the vite build.
- The backend auto-creates and seeds the SQLite database on first startup (`backend/database.db`). No manual migration step is needed.
- Admin password defaults to `admin123` (env var `ADMIN_PASSWORD`).
- The Vite dev server proxies `/api` requests to `http://127.0.0.1:5000`, so the backend must be running for the frontend to work end-to-end.
- Python packages install to `~/.local/` (user install); ensure `~/.local/bin` is on PATH for `pytest` and `flask` CLI.
