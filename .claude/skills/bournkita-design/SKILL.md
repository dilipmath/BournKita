---
name: bournkita-design
description: Design guidelines for BournKita, a Kita (kindergarten) management web app for German-speaking staff. Use when designing or restyling any BournKita screen (landing, dashboard, children, groups, staff, attendance, calendar, board, admin) so new work matches the existing look, the role rules and the accessibility floor.
---

# BournKita design guidelines

Use this file when you design or change any BournKita screen, in plain HTML/CSS today and in React/TypeScript later. Read all of it once, then use the checklists at the end.


## 0. Where the app's decisions win

This skill came with the prototypes in `landing_page/` (`landing_page/index.html`, `landing_page/app.html`), made from what
works in Kita apps such as KIKOM and Little Bird. The app has since settled some points
differently. Where this skill and the list below disagree, the list wins.

- **Words:** `GLOSSARY.md` decides. Attendance states are *not here yet / here / gone home /
  absent* (German *noch nicht da / da / abgeholt / abwesend*). Roles are *Admin / Teacher / Guest*,
  on screen in German *Leitung / Erzieher:in / Gast* (with a colon, as the rest of the app).
- **Guests** see the Kita-wide Calendar only, read-only. Not Today, not counts.
- **Check-out** always goes through the pick-up check (who may pick the Child up). A tap checks a
  Child in; it never checks one out without that check.
- **The Kita overview** (the Admin's start page) shows counts and names only, never what an
  Alert, an Absence or an Incident says. The allergy bar belongs to a Group's Today.
- **No staffing ratio** ("Betreuung jetzt") yet: the app doesn't record who is working.
- **Login:** the account decides the Role (no "I am" chooser, no "view as guest"). Forgot password
  sends a reset link by email. A refused login is focused rather than read out by an alert.
- **Tokens:** the colours below are the app's tokens under English names (chalkboard, chalk,
  paper, line, text-2, blue, sun, raspberry, green, warn); each has a dark-mode value checked to
  the same contrast.
- **Headings** use weight 700 (the typeface has no 800).
- **The prototypes** are reference only: build pages in the React app, with its translation
  files, never by copying the prototypes' markup or sample data.

## 1. Who and what we design for

- **Users:** Kita staff (Erzieher*innen, Leitung) who are not software people, plus read-only guests. They work standing up, on a shared tablet or a phone, often with one hand and with children around.
- **Job of the app:** show who is here, who needs care (allergies), and what is planned today. Everything else is secondary.
- **Context:** runs on the Kita's own server, in German first and English second. No internet services are assumed.
- **Roles:** Leitung (admin), Erzieher*in (teacher), Gast (guest). The screen looks different per role, but the server decides what is allowed (see section 8).

## 2. The design idea: the cloakroom board

Every Kita child has a symbol on their coat hook and name tag. BournKita uses that:

- A child is shown as a **name tag**: a rounded rectangle with a punched hole, a symbol and a first name with initial. Symbols replace photos in lists, so no child photo is needed on screen and basic users recognise children by symbol and name.
- A group has a **paper colour** (construction paper): Affen orange, Schmetterlinge lilac, Käfer green. The colour marks belonging, never meaning on its own.
- The **chalkboard** (deep teal-green) is the ground for the two moments that matter: the landing hero and the attendance board. Tags hang on a rail. Checking in "hangs the tag up".
- **Spend boldness in one place:** the name-tag board. Everything around it (panels, tables, forms) stays quiet, white on chalk-grey, with generous space.

This is deliberately not a cream-and-terracotta page, a dark dashboard with one neon accent, or a grid of identical grey-shadow cards. Do not drift into those.

## 3. Reference apps: what we learn and what we do not copy

KIKOM, Little Bird, Stay Informed and similar German Kita apps share functional patterns worth learning from:

| Pattern seen in this app category | How BournKita uses it |
|---|---|
| Modular "toolbox": modules can be switched on or off by an admin | Navigation is built from a list; a hidden module simply does not appear (see `VIEWS` and `NAV` in `landing_page/app.html`) |
| Group book: daily attendance per group | Attendance view, one chalkboard per group |
| Check-in terminal (QR/NFC at the door) | Planned: same tag board on a wall tablet |
| Leader dashboard: live staffing, birthdays, reminders | "Today" view: care ratio per group, birthday notes, events |
| Separate, simpler parent experience | Planned for release 2, a separate role with its own, smaller navigation |

**Do not copy** any app's logo, name, colours, icons, screenshots, illustrations, wording, or exact layout. Use the patterns above as feature ideas only. Everything visual in BournKita is original, and new screens must stay original.

## 4. Design tokens

Define these as CSS custom properties on `:root` (they exist in `landing_page/index.html` and `landing_page/app.html`; keep both in sync, or move them into one `bournkita.css`).

### Colour

| Token | Hex | Use |
|---|---|---|
| `--tafel` | `#17323A` | Chalkboard ground, sidebar, primary text |
| `--tafel-2` / `--tafel-3` | `#244650` / `#31586A` | Raised surfaces and rails on the chalkboard |
| `--kreide` | `#F2F5F4` | App background (chalk) |
| `--papier` | `#FFFFFF` | Panels, inputs |
| `--linie` | `#D5DEDC` | Borders and dividers |
| `--text-2` | `#4B6168` | Secondary text (6.0:1 on `--kreide`) |
| `--blau` | `#3A47A5` | Primary actions, links (white text 8:1) |
| `--sonne` | `#FFC93C` | Highlights, avatar, "bald" badge, focus on dark |
| `--himbeere` | `#C2255C` | Allergies and errors only |
| `--gruen` | `#1F7A4D` | Success, "gut besetzt" |
| `--warn` / `--warn-hell` | `#8A5A00` / `#FFF0C7` | Caution, birthdays |
| `--g-affen` / `-dk` | `#F6A14A` / `#B85A00` | Group Affen (fill / accent on white) |
| `--g-schmetter` / `-dk` | `#B9A0EC` / `#6B4BB8` | Group Schmetterlinge |
| `--g-kaefer` / `-dk` | `#7CC48A` / `#2E8040` | Group Käfer |

Measured contrast (WCAG): `--tafel` on Affen 6.5, on Schmetterlinge 6.0, on Käfer 6.5; white on `--blau` 8.0; white on `--himbeere` 5.7; `--himbeere` on its tint 4.7; `--gruen` on its tint 4.5; `--text` on `--kreide` 12.3. Recheck if you change any hex value.

Rules:
- Text on a group colour is always `--tafel`. White text on group colours fails; never use it.
- The `-dk` variant is for borders, dots and accents on white. Never use a group colour as the only carrier of meaning.
- **Himbeere is reserved** for allergies and errors. If everything is red, nothing is.
- Adding a fourth group: pick a light, desaturated hue, check `--tafel` text on it reaches 4.5:1 (use a contrast checker), and add `--g-<name>` and `--g-<name>-dk`.

### Typography

- Stack: `"Atkinson Hyperlegible", ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif`. Atkinson Hyperlegible is designed for legibility; use it if you can install or self-host it (OFL licence). Never load fonts from a CDN.
- Base size **17px** (`1.0625rem`), line height 1.5, body weight 400.
- Headings weight **800**, letter-spacing `-0.015em`, line height 1.15.
- Scale: page title `clamp(1.7rem, 3vw, 2.2rem)`, section title `1.2rem`, body `1.0625rem`, small `0.9rem`. Nothing below `0.8rem`.
- Line length at most 70 characters for reading text. Sentence case everywhere. No all-caps labels, no tracked-out eyebrows.
- Tabular numbers for times and counts: `font-variant-numeric: tabular-nums`.

### Shape, space, motion

- Radii: tag `18px`, panel `20px`, control `12px`, pill `999px`. Radius follows role, not one value for everything.
- Spacing on a 4px grid. Page padding 28px (14px on phones). Gap between panels 20px.
- Borders over shadows: panels use `2px solid var(--linie)`. Shadows appear only on tags (`0 3px 0 rgba(0,0,0,.16)`, like paper on a board) and dialogs.
- **Motion:** one orchestrated moment per page (tags swinging onto the rail on the landing page). Otherwise motion only answers an action (tag drops 5px when checked in, toast slides up). Respect `prefers-reduced-motion`.

## 5. Components

### Name tag (child)
- Structure: `button.tile` with `.hole`, `.sym` (46px symbol), `.nm` (name, weight 800), `.meta`.
- Minimum tile size 150 × 164px, tap area is the whole tile.
- Allergy flag: 30px raspberry circle with an alert icon, top right, with an `aria-label` naming the allergen.
- **Attendance states** (always symbol + name + text label, never colour alone):
  - `expected`: transparent with a chalk outline, muted symbol, label "erwartet".
  - `present`: filled with the group colour, label "da 07:48", dropped 5px.
  - `gone`: dim chalkboard fill, label "abgeholt 11:30".
  - `absent`: diagonal stripes, not tappable, label "krank gemeldet" or "im Urlaub". A text button below says "Doch da".
- Tapping cycles `expected → present → gone → expected`. Every change shows a toast with **Rückgängig** for 7 seconds and is announced in an `aria-live` region.

### Allergy bar
Raspberry full-width bar with diagonal hatching, alert icon, title "Allergien heute", and one white pill per child (group-coloured symbol, name, allergen). It sits at the top of the Today view, above everything else, and shows only children who are present or expected.

### Summary strip
Large count ("11") plus "von 18 Kindern sind da", then one dot per child (filled = here, dashed = expected, striped = away, faded = picked up), mini stats, birthday notes. The dot row has a text alternative.

### Buttons
- Primary (`--blau`, white text) at most once per view region. Secondary: white with a 2px border. Danger (`--himbeere`) only inside a confirmation.
- Minimum height 48px (40px only for `btn-sm` inside dense lists). Label is a verb that says what happens: "Speichern", "Archivieren", "Rückmeldung senden". Never "OK", "Submit", "Los".
- The same action keeps the same name in button, toast and announcement ("Archivieren" produces "Profil von Noah archiviert").

### Forms
- Visible label above every field. Hint text beside or below the label, not as placeholder-only.
- Inputs 48px high, 2px border, focus ring `3px solid --blau` with offset.
- Errors: red text under the form, `role="alert"`, say what to do ("Bitte geben Sie eine gültige E-Mail-Adresse ein, zum Beispiel name@gmx.de.") and move focus to the field. Errors never apologise.
- Destructive actions use a two-step confirm that names the consequence ("Es bleibt 12 Monate im Archiv und kann wiederhergestellt werden") and offer undo.

### Panels, tables, lists
- Panel: white, 2px `--linie` border, radius 20px, title with an icon.
- Tables sit in `.tablewrap` (`position: relative; overflow-x: auto`) with a `<caption class="sr">` or visible heading, `<th scope>`. On phones tables scroll inside the wrapper; they never widen the page.
- Group cards have a 14px top border in the group colour.

### Dialogs and drawer
- Use the native `<dialog>` with `showModal()` (focus trap and Escape come for free).
- The child profile is a right-hand **drawer** (full width on phones). Header in the group colour, content sections separated by lines: Allergie, Eltern und Kontakt, Abholberechtigt, Einwilligungen, Essen, Sprachen. Teachers see a lock note: "Änderungen am Profil nimmt die Leitung vor."

### Toast
Dark chalkboard bar, bottom centre (above the tab bar on phones), optional **Rückgängig**, auto-dismiss after 4.5 s (7 s with undo). Toasts confirm; they never carry required information.

### Feedback button
Always in the top bar: "Rückmeldung geben" (icon only on phones). Dialog with three types (Ein Problem, Ein Änderungswunsch, Eine Idee), a message field, and "Aktuelle Seite mitsenden". Crash reports are sent automatically and contain no names or child data.

## 6. Layout and navigation

- **Shell:** at 820px and wider, a chalkboard sidebar (248px) with the logo, grouped navigation (Täglich, Planung, Verwaltung), and the signed-in person at the bottom. Below 820px the navigation becomes a fixed bottom tab bar with icon + label (never icon-only), scrollable sideways.
- **Top bar:** group dropdown (labelled "Gruppe", left border in the group colour), feedback button, sign-out. The group dropdown stays on every screen: choosing a group filters Today, Children, Staff and Attendance.
- **Page head:** title (greeting on Today), one line of context, and the single primary action on the right.
- **Navigation order:** Heute, Kinder, Anwesenheit, Gruppen, Personal, Kalender, Aufgabenboard, then admin items (Benutzer und Rechte, Archiv). Always labelled with the same nouns as the page titles.
- Breakpoints: `1100px` two-column panels collapse, `819px` shell becomes phone layout, `520px` tiles go to two columns.
- Content max width 1240px. Reading text 70ch.
- Landing page: chalkboard hero with the tag rail, role-based login tag at right (hole at top), then "Anwesenheit mit einem Tipp" (interactive demo), a real day timeline (times are the markers because the content is a sequence), a role/permission table, and a privacy section. Do not add numbered markers to content that is not a sequence.

## 7. Role-based UI

| Element | Leitung | Erzieher*in | Gast |
|---|---|---|---|
| Today (counts, events) | yes | yes | counts only, no names |
| Allergy bar, birthdays | yes | yes | hidden |
| Children, profiles | view and edit | view | hidden |
| Add, edit, archive child | yes | hidden | hidden |
| Attendance | edit | edit | hidden |
| Task board | edit | edit | hidden |
| Calendar | edit | group events | read only |
| Staff | view, invite | view | hidden |
| Benutzer und Rechte, Archiv | yes | hidden | hidden |

Rules: hide what a role cannot use instead of disabling it, except where seeing a locked state teaches the user why (the lock note in the drawer). A role label is always visible in the sidebar.

## 8. Security note for designers

The UI only reflects permissions. Every action must also be enforced on the server (FastAPI dependencies). Never rely on hidden buttons. Never put role logic in the URL in production: `?role=` exists only in the prototype.

## 9. Content and microcopy

- Write for a tired educator at 7:30: short, concrete, active voice, plain words. German uses "Sie", with gender-inclusive *in where a role is named (Erzieher*in).
- Name things the way the Kita does: Kinder, Gruppen, Personal, Gruppenbuch, Abholung, Elternabend. Not "Entities", "Records", "Items".
- Say what happened and what to do: "Das Senden hat nicht geklappt. Bitte versuchen Sie es später erneut." Never "Error 500".
- Empty states invite action ("Das Archiv ist leer. Archivierte Kinder erscheinen hier.").
- Keep DE and EN keys in the same dictionary object. Never concatenate translated fragments; use `{placeholders}`.
- Do not show project jargon in production UI (stage names, "Demo-Modus"). The prototype shows them on purpose.

## 10. Accessibility and HMI floor (every screen must pass)

1. Text contrast at least 4.5:1, large text 3:1, UI boundaries 3:1.
2. Touch targets at least 48 × 48px (44px minimum for secondary text buttons).
3. Visible keyboard focus on every interactive element (`outline: 3px solid`), including on the dark chalkboard (use `--sonne`).
4. **No information by colour alone**: state = text + symbol + colour; allergy = icon + word; group = name + colour.
5. Tab order follows reading order; a "Zum Inhalt springen" link is first.
6. Dynamic changes (check-in, task move) are announced via an `aria-live="polite"` region; dialogs have an accessible name.
7. Works at 200% zoom and at 360px width without horizontal page scroll.
8. `prefers-reduced-motion` removes all animation.
9. Forms: labels, error text tied with `aria-describedby`, `autocomplete` values (`username`, `current-password`).
10. Test with a real tablet in portrait and landscape, with gloves-off fat-finger taps, and with a screen reader at least once per release.

## 11. Privacy-by-design for the UI

- No third-party scripts, fonts, analytics, maps or avatars. Everything is served from the Kita server. Set `<meta name="referrer" content="no-referrer">`.
- Prefer symbols over photos in lists and on shared screens. Show a photo only inside a profile and only if the photo consent is on record.
- Sample and demo data are fictional. Never paste real names, addresses, allergies or photos into mockups, screenshots or tests.
- Crash and feedback payloads carry technical context only (view, role, version, user agent), never child or parent data.
- Privacy claims in copy ("Keine Tracker", "Daten bleiben im Haus") must be true in the shipped build. Verify before launch.

## 12. Do and don't

| Do | Don't |
|---|---|
| Use the tag shape for children, panels for everything else | Turn every list into identical rounded cards with shadows |
| Keep one primary action per area | Put three blue buttons in one toolbar |
| Use himbeere only for allergies and errors | Use red for decoration or for "delete" in normal lists |
| Show symbol + name + state text | Show only a coloured dot |
| Confirm destructive actions and offer undo | Delete immediately |
| Keep the group dropdown on every screen | Hide group context in a sub-menu |
| Use real German Kita vocabulary | Translate English software words literally |

## 13. Checklist for a new screen

1. Which role sees it, and what does each role see? (section 7)
2. What is the one primary action? Where does it sit?
3. Which tokens and components exist already? Reuse before inventing.
4. Does it work in the group filter, and what does it show for "Alle Gruppen"?
5. Empty, loading and error states written in plain German and English.
6. Tablet portrait, phone 360px, desktop 1366px checked; no horizontal page scroll.
7. Section 10 passed; section 11 respected.
8. Text lives in the DICT, not hard-coded.

## 14. Prompt template for using this skill

> Design the BournKita screen "<name>" for role(s) <roles>. Follow BOURNKITA-DESIGN-SKILL.md. Reuse the tokens, tag component and shell from `landing_page/app.html`. The primary action is "<verb>". Provide German and English text, empty and error states, and note which API endpoint the data will come from.

## 15. Where things live

- `landing_page/index.html`: public landing page and demo login (hero rail, tag demo, timeline, role table, privacy).
- `landing_page/app.html`: after-login prototype. Sample data (`KIDS`, `STAFF`, `EVENTS`, `TASKS`, `USERS`), views (`vToday`, `vChildren`, `vGroups`, `vStaff`, `vAttendance`, `vCalendar`, `vBoard`, `vUsers`, `vArchive`), `CONFIG` for feedback and crash endpoints, `DICT` for DE/EN.
- `README.md`: how to run it and connect the backend.
