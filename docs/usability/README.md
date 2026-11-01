# Usability test kit for H3 (issue #4)

Release 1 is built, so the "clickable prototype" is the app itself, run on the throwaway test stack with made-up data. This kit holds what is needed to test it with 3 to 5 Kita staff and to record the result. Each sheet comes in English (`en/`) and German (`de/`).

| Sheet (`en/` · `de/`) | What it is |
|---|---|
| `screens/en/`, `screens/de/` | The main screens as they really look on a tablet (in place of wireframes): login, start, a Group's Today view, a Child profile with its Alerts, the Task board, the Calendar, the Staff accounts, Feedback |
| `01-personas-and-task-flows.md` · `01-personas-und-ablaeufe.md` | Who uses the app and the everyday paths through it |
| `02-style-guide.md` · `02-gestaltungsregeln.md` | The rules the screens follow (sizes, touch targets, contrast, icons with text), measured, with what does not meet them yet |
| `03-test-script.md` · `03-testablauf.md` | How to run a session: introduction, the tasks, the closing questions |
| `04-observation-sheet.md` · `04-beobachtungsbogen.md` | One per participant: what happened in each task, the ease rating, quotes |
| `05-findings-and-approval.md` · `05-ergebnisse-und-freigabe.md` | Findings of the expert review and of the sessions, what changes, and the Kita manager's approval |

## Run the test

1. Start the test stack with made-up data (in English, also when the screens are German) and leave it running: `cd frontend && npm run usability-stack`. The app is then at http://localhost:8081; log in as `e2e-admin@kita.example` with `e2e admin password`. Never use real data.
2. Create a Teacher account for the participants (Staff accounts), then open the invitation email in Mailpit at http://localhost:8026 and set its password with the link (replace `localhost` with the laptop's address if you open it on the tablet).
3. Put the app on a tablet: same Wi-Fi, open the laptop's address on port 8081 (the laptop's firewall may need to allow it). Or let participants use the laptop. The app starts in English on every page load: tap "Deutsch" again after a reload (finding E7).
4. Run 3 to 5 sessions of about 30 minutes, one participant at a time, with `03` and one `04` per person.
5. Collect the findings in `05`, decide what changes, and have the Kita manager sign it.
6. Remove the test stack: `docker compose -p kita-e2e down --volumes`.

## Refresh the screens

`cd frontend && npm run screens` starts the throwaway stack, adds made-up data, saves the screenshots into `screens/` and removes the stack again.

## Afterwards

Give the filled-in sheets to Claude, which records the findings on issue #4, turns every agreed change into a ticket, and updates the screens.
