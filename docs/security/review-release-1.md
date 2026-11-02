# Security review: Release 1 (H5, issue #32)

Reviewed: 1 November 2026, commit after `dc74459`, by Claude (code review, scans and tests). Scope: the backend (FastAPI), the frontend (React), the web server (Caddy), the production stack and the backups. An independent reviewer should still look at it before go-live (see the end).

## Summary

No critical or high findings. Fixed in this review: missing browser security headers, one build-tool dependency, and the PDF generator fetching nothing from outside. Open, as tickets: logging of failed logins, a login limit per network address (without it, anyone in the network can keep an account locked), a limit on crash reports, and the points from the data-protection drafts (H2) that touch security. One accepted exception needs the Kita's confirmation: Teachers record the day's work for every Child (section 4).

## 1. Scans

| Scan | Result | Decision |
|---|---|---|
| `pip-audit` on the backend's locked dependencies (incl. development) | No known vulnerabilities | — |
| `npm audit --omit=dev` (what ships to the browser) | No vulnerabilities | — |
| `npm audit` (incl. build tools) | 11 (3 low, 8 moderate), all in build tools: `serialize-javascript`, and `vite-plugin-pwa` → `workbox-build` → `glob`, `minimatch`, `ejs`, `deepmerge` | `serialize-javascript` **updated** (7.1.2 → 7.1.4). The other 10 **accepted**: they run only while building, on the developer's machine and in CI, with the project's own files; none reaches the browser. npm's only "fix" is a downgrade of `vite-plugin-pwa` (2.0 → 1.1), so: watch for a new `workbox-build` |
| `bandit -r src` (backend) | 15 low, all B101 "use of assert" | **Accepted**: the asserts state facts the code relies on (e.g. "the insert returned an ID"), never a security check, and the app does not run with `python -O` |
| `ruff --select S` (bandit's rules in ruff) | The same 15 | As above |
| Frontend search for risky patterns (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, links opening new tabs) | None, except one new-tab link (Emergency list), which has `rel="noopener"`. Browser storage holds only the last Group's ID and the language | — |

## 2. OWASP Top 10 (2021)

| # | Risk | What the app does | Result |
|---|---|---|---|
| A01 | **Broken access control** | Every route needs a login unless public (login, email links, crash reports). Roles checked on the server for every request; Guests refused everywhere by default. Records are always looked up under the Child, Group or Parent in the address (e.g. a contact only with its own Child), so an ID from elsewhere is not found. A Teacher's Incident log is filtered on the server. Archived Children answer 404 everywhere. Tests walk **every** route of the API as a Guest (refused all but the Calendar, the session and Feedback) and, new in this review, every route that **changes** data as a Teacher (refused all but the day's work: Attendance, Absences, Incidents, Tasks, Events, Feedback); a further new test checks that a Teacher cannot **read** the Admin-only pages (Staff accounts, Audit log, Archive, Feedback, Holidays, data export). That the Teacher walk catches a missing Admin check was tried (by removing one; it failed) | ✓ |
| A02 | **Cryptographic failures** | HTTPS only in production (HSTS); addresses, phones, emails, health data, Incident texts, Feedback and photos encrypted with AES-256-GCM, each value bound to its record; key kept apart. Passwords hashed with Argon2; session, verification and reset tokens are random (256 bits) and stored only as SHA-256 hashes. Off-site backups encrypted with age | ✓ |
| A03 | **Injection** | All database access through SQLAlchemy with bound parameters (the one raw query is a constant `SELECT 1`). React escapes all output; no raw HTML. The Emergency list's HTML escapes every value. Email subjects are built from fixed words, and Python's email library refuses line breaks in headers. iCal and photo uploads are parsed by libraries, with size and pixel limits | ✓ |
| A04 | **Insecure design** | Lockout after 5 failed logins (15 minutes); password reset answers the same for every address (no account probing) and is throttled; deleting is two-step; data deleted for good only on purpose (Deletion request) or by the Purge; the Audit log cannot be edited. **No limit per network address** on logins: someone in the Kita network could try one password against many accounts, or **lock any account, an Admin's too, again and again** (5 wrong passwords every 15 minutes) | ⚠ finding S2 |
| A05 | **Security misconfiguration** | Only the web server is reachable; database and API are not. Production needs its own encryption key and database password (the stack refuses to start without them). API docs (`/docs`, `/openapi.json`) are not reachable through the web server. **Fixed in this review:** the web server now sends `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY` on every answer, and a strict Content-Security-Policy (only the app's own files; no framing) on the app's pages; API answers (JSON, photos, the Emergency list PDF) do not get the policy and rely on nosniff. A new end-to-end test checks the headers; that no page of the app breaks the policy was checked once in this review (each main page opened, no violation in the browser console), not by a test | ✓ (fixed) |
| A06 | **Vulnerable and outdated components** | See the scans (section 1) | ✓ (accepted build-tool findings) |
| A07 | **Identification and authentication failures** | Passwords of at least 12 characters; lockout; sessions end after 30 minutes without activity; a new session on every login; logout and password reset end sessions; cookies HttpOnly, Secure (production), SameSite=Strict; links in emails work once and expire (7 days, 1 hour) | ✓ |
| A08 | **Software and data integrity failures** | Cross-site requests are blocked by SameSite=Strict cookies (for every request, including the photo and Holidays uploads, which are form data rather than JSON). Uploads are re-encoded (photos lose their metadata). Dependencies are locked (`uv.lock`, `package-lock.json`) | ✓ |
| A09 | **Security logging and monitoring failures** | Every view and change of a Child's data in the audit log; crashes and failed backups reported to the developer. **Failed logins and lockouts are not logged**, so a password-guessing attempt goes unnoticed | ⚠ finding S1 |
| A10 | **Server-side request forgery** | The app never fetches a URL given by a Staff member (Holidays are imported from an uploaded file, not a link). **Fixed in this review:** the PDF generator (WeasyPrint) is told to fetch nothing, so no text in an Emergency list could make the server load a URL or file | ✓ (fixed) |

## 3. Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| F1 | No Content-Security-Policy, `nosniff` or framing protection | medium | **Fixed** (web server headers, e2e test) |
| F2 | `serialize-javascript` 7.1.2 (build tool) has a known XSS | low (build only) | **Fixed** (7.1.4) |
| F3 | PDF generator could fetch URLs or files named in its HTML | low (values are escaped) | **Fixed** (fetches nothing) |
| S1 | Failed logins and lockouts are not logged | medium | **Fixed** (#37): every refused login is logged with the account's number and the network address, never the typed email or password; a lockout is also reported like a crash |
| S2 | No login limit per network address (only per account): anyone in the network can guess passwords across accounts, or keep any account locked, an Admin's too | medium (Kita network only) | **Fixed** (#38): 20 failed logins from one address in 10 minutes refuse its logins (429) until the oldest is 10 minutes old; the address comes from the web server, which overwrites any such header a client sends; an Admin can unlock an account on the Staff accounts page |
| S5 | `POST /api/crash-reports` needs no login and has no limit; each report emails the developer, so it can flood that mailbox | low (Kita network only) | **Fixed** (#39): at most 30 reports per address in 10 minutes (429), and at most 5 crash emails an hour from browsers (the API's own reports always go), the next one counting those left out; the log keeps all. The backup-failure route is refused by the web server from outside (checked by `backup/test-restore.sh`) |
| S3 | 10 moderate/low findings in build tools (`workbox-build` chain) | low (build only) | **Accepted**; update `vite-plugin-pwa` when a fixed `workbox-build` is released |
| S4 | 15 asserts (bandit B101) | info | **Accepted** |

Also relevant, from other reviews: tablets need a screen lock, and the server log holds emails if no mail server is set (H2, `docs/data-protection`); the border contrast and small calendar chips (H3) are accessibility, not security.

## 4. Manual check: Teachers and Guests cannot change Child data

Done as tests rather than by hand, so it is repeated on every change:

- `backend/tests/test_permissions.py`: a Teacher is refused (403) on every route that changes data, except the day's work (listed in the test), and on every Admin-only page.
- **Accepted exception, for sign-off:** the day's work is Child data too. A Teacher records Attendance, Absences (with their reason, which can be health data) and Incidents for **every** Child, and changes Tasks and Events of every Group, not only their own Groups'. This is on purpose (any Teacher may cover, as the Glossary says), but it is a decision the Kita should confirm (see also H2, open point 3).
- `backend/tests/test_guests.py`: a Guest is refused on every route but the Calendar, the session and Feedback; only the known public routes answer without a login.
- In the app, the buttons for changing Child profiles are only shown to Admins (frontend tests); the server refuses either way.

## 5. Before go-live

- An independent reviewer (e.g. the carrier's IT or a security consultant) looks at this report and the production server once installed (H4): firewall, disk encryption, updates, that no port is forwarded.
- S1, S2 and S5 settled (#37, #38, #39).
- Repeat the scans before each release: `pip-audit`, `npm audit`, `bandit`.

Reviewer sign-off: ______________________  Date: ____________
