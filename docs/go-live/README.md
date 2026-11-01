# Go-live, manual and training (H7, issue #34)

What the Kita needs to start using the app for real, and to keep using it. Each sheet comes in English (`en/`) and German (`de/`).

| Sheet (`en/` · `de/`) | For | What it is |
|---|---|---|
| `01-user-manual.md` · `01-handbuch.md` | Every Staff member; part 2 for Admins | How to use the app, with pictures of the real screens |
| `02-quick-start-cards.md` · `02-kurzanleitungen.md` | Next to the tablets, laminated | Three one-page cards: every day, emergency, Admins |
| `03-training-plan.md` · `03-schulungsplan.md` | Whoever trains | Two sessions: all Staff (60 minutes), Admins (90 minutes) |
| `04-go-live-checklist.md` · `04-start-checkliste.md` | The Kita manager and IT | Every step to go live: install, real data, verified backups, paper fallback |
| `05-support-and-releases.md` · `05-support-und-updates.md` | Everyone; the developer | Who to ask, how fast, and how a new version is made and installed |

The pictures are the screens of the usability test (`docs/usability/screens`); `cd frontend && npm run screens` takes them again after the app changes. Print the manual from a Markdown viewer (or convert it, e.g. `pandoc 01-user-manual.md -o manual.pdf`), from inside its folder so the pictures are found.

## Afterwards

Tell Claude when the checklist is ticked: it records go-live on issue #34 and closes the Release 1 issues that are done.
