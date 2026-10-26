# BournKita — Kita Kids Database

Web application for Kita staff: Child profiles with safety data, groups, task board, calendar and attendance. Runs on a server inside the Kita's local network. See `AGENTS.md` and issue #1 for the Release 1 spec.

## Run the app

Requires Docker.

```
docker compose up -d --build --wait
```

Open http://localhost:8080.

The `api` service applies database migrations when it starts. Create the first Admin once, and you'll be asked for a password (at least 12 characters):

```
docker compose exec api kita-admin create-admin --email you@example.com
```

This only works while no accounts exist. Sessions end after 30 minutes without activity (`KITA_SESSION_INACTIVITY_MINUTES`). This development stack serves plain HTTP, so it turns off the session cookie's `Secure` flag (`KITA_SESSION_COOKIE_SECURE=false`); otherwise tablets on the network could not stay logged in. The production stack with HTTPS (#31) must leave it on.

Crash reports from the browser and the API are always logged by the `api` service. Setting `KITA_CRASH_REPORT_EMAIL` also sends them to that address through the Mailer. Until an SMTP Mailer exists, the development Mailer only logs each email's subject. Reports never contain error messages, query strings, deeper page paths or other free text, so no names, addresses or health data.

## Develop

Backend (Python, FastAPI) — needs the database from Compose (`docker compose up -d --wait db`):

```
cd backend
uv sync
uv run pytest      # API tests against a separate kita_test database on port 5433
uv run kita-admin migrate
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
npm run test:e2e   # Playwright on a tablet viewport, against http://localhost:8080 (full stack);
                   # creates the e2e Admin with kita-admin, so run it against an empty database
```
