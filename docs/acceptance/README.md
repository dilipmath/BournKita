# User acceptance test kit for H6 (issue #33)

The Release 1 acceptance test: Kita staff try every part of the app on the Kita's own server and tablets, with made-up data, before it goes live. The Kita manager then signs it off. Each sheet comes in English (`en/`) and German (`de/`).

| Sheet (`en/` · `de/`) | For | What it is |
|---|---|---|
| `01-test-plan.md` · `01-testplan.md` | Whoever organises the test | Who, when, where, what must be ready first, how findings are rated, when the test is passed, and how to clear the server afterwards |
| `02-test-cases.md` · `02-testfaelle.md` | The testers (print one per pair) | The test cases, in order: Admins set up made-up data first, then Teachers and a Guest work with it |
| `03-findings-log.md` · `03-befundliste.md` | Whoever runs the test | Every finding, its rating and what happens with it |
| `04-sign-off.md` · `04-abnahme.md` | The Kita manager | The outcome and the signature |

## Run the test

1. Before the day: everything under "Ready first" in `01` is done; the server runs the release to be tested (`docs/server`), still without real data.
2. On the day: work through `02` in order, ticking each case and writing down anything odd. Every ✗ or "odd" becomes a line in `03`.
3. Rate the findings together at the end (`01`, "Rating findings").
4. The next morning, the developer or IT runs part C.
5. The Kita manager signs `04`: passed, passed with conditions, or not passed.
6. Clear the made-up data from the server (`01`, "Afterwards").

## Afterwards

Give the filled-in sheets to Claude, which turns every finding into a GitHub issue with the agreed labels, records the outcome on issue #33, and plans the fixes. Go-live (H7, issue #34) waits for the sign-off.
