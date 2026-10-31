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

This only works while no accounts exist. Further Staff members are created by an Admin on the Staff accounts page; each gets an email with a link (valid 7 days) for choosing their password. Links in emails point to `KITA_PUBLIC_URL` (default `http://localhost:8080`). Staff members who forgot their password ask for a reset link on the login page (valid 1 hour, works once; using it ends all their sessions). Five failed logins in a row lock an account for 15 minutes; choosing a new password with a reset link unlocks it. Sessions end after 30 minutes without activity (`KITA_SESSION_INACTIVITY_MINUTES`). This development stack serves plain HTTP, so it turns off the session cookie's `Secure` flag (`KITA_SESSION_COOKIE_SECURE=false`); otherwise tablets on the network could not stay logged in. The production stack (`compose.prod.yaml`, HTTPS) leaves it on.

Addresses, contact and health data are stored encrypted (AES-256-GCM) with the key in `KITA_ENCRYPTION_KEY`; the app does not start without it. This development stack has a fixed, public default key. For real data, make one with `docker compose exec api kita-admin generate-key`, keep it apart from the database backups, and never lose it: without the key, encrypted data cannot be read. Photos are kept encrypted with the same key, as files in `KITA_PHOTO_FOLDER` (here a Docker volume); back that folder up together with the database.

Crash reports from the browser and the API are always logged by the `api` service. Setting `KITA_CRASH_REPORT_EMAIL` also emails them to that address. Reports never contain error messages, query strings, deeper page paths or other free text, so no names, addresses or health data.

Every page has a Feedback button (for everyone logged in, Guests too): a problem, change request or idea, with the page it came from and who sent it. It is stored (the text encrypted) and emailed to `KITA_FEEDBACK_EMAIL`, or to `KITA_CRASH_REPORT_EMAIL` when that is unset; with neither, it is only stored. Admins can read it all at `GET /api/feedback`. If the email cannot be sent, the feedback is kept and the failure is filed as a crash report.

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

Admins can also create Guest accounts: a Guest logs in like anyone else but sees only the Kita-wide Calendar (the whole Kita's Events and the Holidays), read-only. Every other part of the API refuses Guests unless it explicitly lets them in, so no personal data reaches them; they get no Reminders either.

Deleting a Child profile moves it to the archive (Admins only, in the menu), with all its data and photos; it is in no current view, and an Admin can restore it from there. A job inside the `api` service purges archived Children for good once the retention period has passed since they were deleted: `KITA_ARCHIVE_RETENTION_MONTHS` (default 12, a placeholder until the data-protection assessment sets it). The purge also deletes their Parents who have no other Child, and runs every hour (`KITA_PURGE_CHECK_SECONDS`; `0` turns it off).

For data-subject requests, an Admin opens the Parent's page: "Export all data (ZIP)" downloads everything held about the Parent and their Children, archived ones included (`data.json` plus the photos as JPEG files; the Children's other Parents by name only; each Child's audit log entries, with Staff members by Role only; when each record was made and last changed); "Delete all data" deletes all of it for good at once, with the photo files, and cannot be undone. The audit log records both, but none of the deleted data.

Holidays come from iCal files (`.ics`): an Admin imports the region's public holidays and school holidays on the Holidays page (Calendar → Holidays), e.g. from a file downloaded from a holiday website. Importing a kind again replaces it. Files with repeating entries are refused; holiday files list each holiday with its dates.

## Run in production

On the Kita's server (Linux with Docker, its disk encrypted), with `compose.prod.yaml`: the app over HTTPS for the Kita's own host name, reachable only inside the Kita's network, plus nightly and weekly backups. Never forward its ports from the internet.

1. Copy `.env.prod.example` to `.env`, fill it in, and make it readable by root only (`chmod 600 .env`). It says how to make the two keys: the app's encryption key (`kita-admin generate-key`) and the off-site backup's age key pair (`age-keygen`). Keep the encryption key and the age private key apart from the server and the backups, e.g. printed, in the Kita's safe: without them no backup can be read, and with them anyone holding a backup can.
2. Make the host name (`KITA_HOSTNAME`, e.g. `kita.home.arpa`) point to the server in the router's DNS. Not a `.local` name: tablets look those up themselves, past the router.
3. Start it: `docker compose -f compose.prod.yaml up -d --build --wait`, then create the first Admin: `docker compose -f compose.prod.yaml exec api kita-admin create-admin --email you@example.com`.
4. Install Caddy's root certificate on every tablet, once, so they trust the app's HTTPS: copy it out with `docker compose -f compose.prod.yaml cp web:/data/caddy/pki/authorities/local/root.crt kita-root.crt` and install it as a trusted certificate authority (Android: Settings → Security → Encryption & credentials → Install a certificate → CA certificate; iPad: open the file, install the profile, then turn on full trust under Settings → General → About → Certificate Trust Settings). It stays the same across updates (it is kept in the `caddy-data` volume); never delete that volume.

Updates: `git pull` and the same `up -d --build --wait`; the API applies new database migrations when it starts.

### Backups

The `backup` service runs them at the Kita's local time and logs them (`docker compose -f compose.prod.yaml logs backup`):

- **Nightly, 01:30**, onto the second drive (`KITA_BACKUP_DIR`): a dump of the database and a snapshot of the photo folder. The photos are encrypted with the app's key already; each snapshot shares the files of unchanged photos with the one before. The last 14 are kept (`KITA_BACKUP_KEEP_NIGHTLY`).
- **Weekly, Sunday 04:00**, to `KITA_OFFSITE_DIR`: the newest nightly backup as one file, encrypted to the age public key, for taking out of the building (e.g. a USB drive swapped each week). Only the age private key opens it, so the server cannot read its own off-site copies. The last 8 are kept (`KITA_BACKUP_KEEP_WEEKLY`).

The nightly database dumps hold everything the app does not encrypt itself (e.g. names), readable by root only: encrypt the second drive like the server's own disk. The off-site copies are encrypted anyway.

Data deleted in the app (a Purge or a Deletion request) stays in the backups until they are dropped: up to 14 days on the second drive and 8 weeks off-site. The data-protection assessment should say whether that is acceptable.

A failed backup is reported like a crash: logged by the `api` service and emailed to `KITA_CRASH_REPORT_EMAIL`, saying which backup failed; the backup log says why. Set that address, or nobody hears of it. So is a backup service that cannot start its schedule (e.g. the backup drive is missing); it checks again every hour. The weekly backup also refuses to send off a nightly one more than two days old, so failing nightly backups are reported a second time. Only a backup service that is not running at all reports nothing: check `docker compose -f compose.prod.yaml ps` now and then.

Run one by hand with `docker compose -f compose.prod.yaml exec backup run-job nightly` (or `weekly`).

### Restore

Always into a fresh database and photo folder: the restore refuses to overwrite data that is still there. You need the app's encryption key (`KITA_ENCRYPTION_KEY`) in `.env` as it was when the backup was made.

```
docker compose -f compose.prod.yaml down
docker volume rm kita_db-data kita_photos        # only if the old data is to go!
docker compose -f compose.prod.yaml up -d --wait db
docker compose -f compose.prod.yaml run --rm --no-deps backup restore latest        # or: restore 2027-01-04
docker compose -f compose.prod.yaml up -d --wait
```

Leave the `kita_caddy-data` volume: it holds the certificate authority the tablets trust. On a new server, start from empty volumes; the tablets then need the new root certificate (step 4 above).

From an off-site backup, when the second drive is lost too: put the backup file into `KITA_OFFSITE_DIR` and the age private key into a file (e.g. `/root/age-identity.txt`), then instead of `restore latest`:

```
docker compose -f compose.prod.yaml run --rm --no-deps -v /root/age-identity.txt:/run/age-identity.txt:ro backup \
  restore-offsite /offsite/kita-2027-01-04.tar.age /run/age-identity.txt
```

`bash backup/test-restore.sh` tests all of this end to end (CI runs it on every push): it starts the production stack with test settings, records a Child with an Alert and a photo over HTTPS, runs both backups, restores each into a fresh database and photo folder, and checks through the API that everything is back. It also checks that a failed backup, and a backup service that cannot start its schedule, are reported as crashes.

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
