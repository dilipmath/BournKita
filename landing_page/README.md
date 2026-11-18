# BournKita web prototype

Redesigned public landing page and after-login dashboard for the BournKita Kita app. Plain HTML, CSS and JavaScript, no build step, no external requests.

| File | What it is |
|---|---|
| `index.html` | Public landing page: login (Erzieher*in, Leitung, Gast), tag demo, day timeline, role table, privacy section |
| `app.html` | After-login dashboard: Today, Children, Attendance, Groups, Staff, Calendar, Task board, plus admin pages Users and permissions and Archive |
| `BOURNKITA-DESIGN-SKILL.md` | Reusable design guidelines (tokens, components, role rules, accessibility floor, copy rules) |
| `README.md` | This file |

## Status: prototype, not production

- All data in `app.html` is **fictional sample data** held in JavaScript arrays. Changes (check-in, add child, archive, role change) live only in the open page and are lost on reload.
- The login form is a **demo**. It validates the fields, stores the chosen role in `sessionStorage` and opens `app.html?role=...`. It sends nothing anywhere, and the role in the URL is not secure. Replace it before real use (section "Connect the backend").
- Tested in headless Chromium at 1366 px, 390 px and with keyboard focus checks. Not yet tested on Safari, on a real iPad or Android tablet, or with a screen reader. Do that before the pilot (stage S11).
- The calendar is an agenda list; the month view is still to be built.

## Run it

Open `index.html` in a browser. Or serve the folder:

```bash
cd bournkita
python3 -m http.server 8080
# open http://localhost:8080/index.html
```

Try the roles directly: `app.html?role=admin`, `app.html?role=teacher`, `app.html?role=guest`. The language follows the browser (German or English); the switch is at the bottom of every page.

## What each role sees (prototype)

| | Leitung | Erzieher*in | Gast |
|---|---|---|---|
| Today | all | all | counts only |
| Children, Attendance, Staff | all, can add/edit/archive children | view, record attendance | hidden |
| Task board | edit | edit | hidden |
| Users and permissions, Archive | yes | hidden | hidden |

The UI hides what a role cannot use. **The server must enforce the same rules**; hidden buttons are not security.

## Connect the backend (FastAPI)

Search `app.html` for `TODO` to find every place that needs an API call. Suggested contract:

| Prototype action | Endpoint | Notes |
|---|---|---|
| Sign in (`index.html`, `submit` handler) | `POST /api/auth/login` | Return the role; set an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. Remove the `?role=` query and the `sessionStorage` role. |
| Who am I (`app.html`, top of script) | `GET /api/me` | `{name, role}`. Replace `role` from the URL with this. |
| Children | `GET /api/children`, `POST`, `PUT /:id`, `DELETE /:id` | `DELETE` is a soft delete into the archive; `GET /api/children/archived` for the Archive page. Admin only for writes. |
| Groups, staff | `GET /api/groups`, `GET /api/staff` | |
| Attendance | `POST /api/attendance` `{child_id, state, time}`; `GET /api/attendance?date=` | States: `expected`, `present`, `gone`, `absent` (+ `reason`). |
| Tasks | `GET/POST /api/tasks`, `PATCH /api/tasks/:id` | |
| Events | `GET /api/events` | |
| Users and permissions | `GET /api/users`, `PATCH /api/users/:id` | Admin only. |
| Feedback | `POST /api/feedback` | Set `CONFIG.feedbackUrl`. Payload: `{type, message, view, role, version, ts}`. Forward to Azure DevOps or email. |
| Crash reports | `POST /api/crash` | Set `CONFIG.crashUrl`. Sent with `navigator.sendBeacon`, no personal data. |

How to swap the data in `app.html`:

1. Replace the `GROUPS`, `KIDS`, `STAFF`, `EVENTS`, `TASKS`, `USERS` arrays with data loaded from the API before the first `route()` call (`fetch` then `render()`).
2. Keep the field names (`state`, `time`, `allergy`, `group`, `sym`) or map them in one place.
3. Replace each `/* TODO ... */` comment with the matching `fetch`. On failure, call `toast(t("fb.fail"))`, not `alert`.
4. Add the child symbol (`sym`) as a column on the child table; it is how children are recognised on screen.

Serve the static files from the same origin as the API (FastAPI `StaticFiles` or Caddy), so no CORS and no third-party hosts are needed.

## Recommended security headers (Caddy example)

```
header {
  Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
  Referrer-Policy "no-referrer"
  X-Content-Type-Options "nosniff"
}
```

The pages use inline `<style>` and `<script>`, hence `'unsafe-inline'`. When you move to React/Vite with separate files, tighten this to `'self'` only.

## Fonts

The pages use **Atkinson Hyperlegible** if it is installed on the device and fall back to system rounded fonts otherwise. To ship it with the app (recommended for tablets):

1. Download the font from the Braille Institute (SIL Open Font Licence) and convert to `woff2`.
2. Put the files in `fonts/` next to the pages.
3. In both `@font-face` rules add the file as a source, for example:
   `src: local("Atkinson Hyperlegible"), url("fonts/AtkinsonHyperlegible-Regular.woff2") format("woff2");`

Do not link to Google Fonts or any CDN: it would send every visitor's IP address to a third party and break offline use.

## Move to React and TypeScript later

- The CSS custom properties become your theme (`:root` block). Keep the names.
- `vToday`, `vChildren`, `vAttendance`, ... map one to one to page components; `.tile` is a `NameTag` component with a `state` prop; `.panel`, `.chip`, `.btn` are small shared components.
- `DICT` moves to a JSON file per language (e.g. react-i18next). Keep the keys.
- The `NAV` and `VIEWS` objects become route definitions plus a permission map that mirrors the server's.

## Using the design skill

`BOURNKITA-DESIGN-SKILL.md` has a skill header. To use it with Claude, add it as a skill (or paste it into the project instructions) and ask, for example: "Design the Calendar month view for Leitung and Erzieher*in following the BournKita design skill; reuse the tokens and components from `app.html`."

## Before the pilot: checklist

- [ ] Replace the demo login and `?role=` with real authentication and server-side role checks
- [ ] Load real data through the API; remove all sample data
- [ ] Fill the footer links on the landing page: Hilfe und Feedback, Impressum, Datenschutzerklärung (a legal imprint and privacy notice are required)
- [ ] Check that the claims in the privacy section ("Eigener Server", "Keine Tracker", "Archiv mit Frist", "Nachvollziehbar") are true in the finished build: audit log, retention job, no external requests
- [ ] Self-host the font, add the security headers, serve over HTTPS
- [ ] Test on the real tablet(s) in portrait and landscape, and with a screen reader
- [ ] Have two or three Kita staff try the attendance board and the child profile and note where they hesitate
- [ ] Confirm the data-protection basis for children's data with the Kita's operator (Träger) before storing real data

## Known gaps

- Month view for the calendar, drag-and-drop for the task board (tasks move by tapping), photo upload, consent editing, parent portal, daily report, AI features: not in this prototype (see the development plan).
- The role table on the landing page says teachers can manage group events; the app currently shows them events read-only. Align both when the calendar is built.
- The care ratio threshold (`CONFIG.maxChildrenPerStaff`, 8) is a placeholder. The legal staffing key depends on the federal state and the operator; set it with the Kita.
