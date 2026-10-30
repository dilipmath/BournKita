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

This only works while no accounts exist. Further Staff members are created by an Admin on the Staff accounts page; each gets an email with a link (valid 7 days) for choosing their password. Links in emails point to `KITA_PUBLIC_URL` (default `http://localhost:8080`). Staff members who forgot their password ask for a reset link on the login page (valid 1 hour, works once; using it ends all their sessions). Five failed logins in a row lock an account for 15 minutes; choosing a new password with a reset link unlocks it. Sessions end after 30 minutes without activity (`KITA_SESSION_INACTIVITY_MINUTES`). This development stack serves plain HTTP, so it turns off the session cookie's `Secure` flag (`KITA_SESSION_COOKIE_SECURE=false`); otherwise tablets on the network could not stay logged in. The production stack with HTTPS (#31) must leave it on.

Addresses, contact and health data are stored encrypted (AES-256-GCM) with the key in `KITA_ENCRYPTION_KEY`; the app does not start without it. This development stack has a fixed, public default key. For real data, make one with `docker compose exec api kita-admin generate-key`, keep it apart from the database backups, and never lose it: without the key, encrypted data cannot be read. Photos are kept encrypted with the same key, as files in `KITA_PHOTO_FOLDER` (here a Docker volume); back that folder up together with the database.

Crash reports from the browser and the API are always logged by the `api` service. Setting `KITA_CRASH_REPORT_EMAIL` also emails them to that address. Reports never contain error messages, query strings, deeper page paths or other free text, so no names, addresses or health data.

### Email

This stack sends all email to [Mailpit](https://mailpit.axllent.org/), which catches it instead of delivering it: read it at http://localhost:8025. To send real email, point the `api` service at a mail server:

| Setting | Default here | Meaning |
|---|---|---|
| `KITA_SMTP_HOST` | `mailpit` | Mail server; unset means emails are only written to the `api` log |
| `KITA_SMTP_PORT` | `1025` | Port (usually 587 for STARTTLS, 465 for TLS) |
| `KITA_SMTP_SECURITY` | `none` | `starttls`, `tls` or `none` |
| `KITA_SMTP_USERNAME`, `KITA_SMTP_PASSWORD` | empty | Login, if the server needs one |
| `KITA_MAIL_FROM` | `Kita Kids Database <kita@localhost>` | Sender address |

If an email cannot be sent, the action still completes (a new Staff member's account is still created) and the failure is filed as a crash report; the Admin can use "Send new link" later.

Events can ask for a Reminder (that morning, or 1, 2 or 7 days before). A job inside the `api` service looks for due Reminders every 5 minutes (`KITA_REMINDER_CHECK_SECONDS`; `0` turns it off) and, from 07:00 Kita time, emails each active Staff member of the Event's Group (for the whole Kita: every one) once. A Reminder that could not be sent, or was missed while the server was off, goes out on a later run until the Event begins.

Holidays come from iCal files (`.ics`): an Admin imports the region's public holidays and school holidays on the Holidays page (Calendar → Holidays), e.g. from a file downloaded from a holiday website. Importing a kind again replaces it. Files with repeating entries are refused; holiday files list each holiday with its dates.

## Develop

Backend (Python, FastAPI) — needs the database from Compose (`docker compose up -d --wait db`), and Pango for the emergency list PDF ([WeasyPrint](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html); on Debian/Ubuntu `apt install libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 fonts-dejavu-core`):

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
npm run test:e2e   # Playwright on a tablet viewport, against a throwaway copy of the stack
                   # (compose.e2e.yaml, http://localhost:8081) with an empty database, removed
                   # afterwards; so tests never fill the development database. Arguments go to
                   # Playwright (npm run test:e2e -- e2e/backlog.spec.ts); --keep leaves it running.
npm run test:e2e:dev  # Playwright against the running development stack (http://localhost:8080);
                      # its test data stays there
```
