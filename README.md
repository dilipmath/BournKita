# BournKita — Kita Kids Database

Web application for Kita staff: Child profiles with safety data, groups, task board, calendar and attendance. Runs on a server inside the Kita's local network. See `AGENTS.md` and issue #1 for the Release 1 spec.

## Run the app

Requires Docker.

```
docker compose up -d --build --wait
```

Open http://localhost:8080.

Crash reports from the browser and the API are always logged by the `api` service. Setting `KITA_CRASH_REPORT_EMAIL` also sends them to that address through the Mailer. Until an SMTP Mailer exists, the development Mailer only logs each email's subject. Reports never contain error messages, query strings, deeper page paths or other free text, so no names, addresses or health data.

## Develop

Backend (Python, FastAPI) — needs the database from Compose (`docker compose up -d --wait db`):

```
cd backend
uv sync
uv run pytest      # API tests against the real PostgreSQL on port 5433
uv run mypy
uv run ruff check .
uv run uvicorn kita.main:app --reload
```

Frontend (React, TypeScript, Vite):

```
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on port 8000
npm run build
npm run lint
npm test           # Vitest unit tests
npm run test:e2e   # Playwright on a tablet viewport, against http://localhost:8080 (full stack)
```
