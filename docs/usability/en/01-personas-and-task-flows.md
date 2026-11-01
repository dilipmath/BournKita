# Personas and task flows

Made-up Staff members who stand for those who will use the app; check them against the interviews of H1 (#2) and correct them.

## Personas

**Sabine, Kita manager (Admin), 52.** Runs the Kita, keeps the Child profiles and the Staff accounts, answers Parents' questions. Works at the office PC and walks around with a tablet. Comfortable with email and spreadsheets, not with "apps". Wants: everything about a Child in one place, nothing forgotten in an emergency, no trouble with data protection.

**Aylin, Teacher in the Monkeys Group, 34.** Greets Children at the door, runs the group room, tells colleagues who is allergic to what. Uses her phone a lot, the group-room tablet sometimes. Wants: see at a glance who is here and what to watch out for; tick Children in and out quickly with a Child on her arm.

**Jens, Teacher in the Butterflies Group, 58.** Twenty years at the Kita; uses a computer only when he has to; reading glasses. Wants: large buttons, plain words, no way to break anything.

**Lea, trainee (Teacher or Guest), 19.** In the Kita three days a week. Should see the calendar and the day's plan, not necessarily the Child profiles.

## Task flows

The everyday paths, each with where it starts and how many taps it should take.

| # | Flow | Who | Steps | Taps |
|---|---|---|---|---|
| 1 | Morning: who is coming, who has an Alert | Teacher | Start → pick Group → Today view | 2 |
| 2 | Check a Child in at the door | Teacher | Today view → "Check in" on the Child | 1 |
| 3 | Check a Child out; is this person allowed to pick up? | Teacher | Today view → Child's name → "Who may pick up" (photos) → back → "Check out" | 3 |
| 4 | A Parent calls in sick | Teacher | Today view → "Absent" on the Child → reason, days → Save | 3–4 |
| 5 | A fall in the garden | Teacher | Today view → "Report incident" → what happened, who was informed → Save | 3 |
| 6 | Fire drill | Teacher | Group → "Emergency list (PDF)" → print | 2 |
| 7 | Plan the week's work | Teacher | Group → "Task board" → add a Task, move it | 3 |
| 8 | Add the parents' evening | Teacher | Group → "Calendar" → "Add event" → title, day, time → Save | 4 |
| 9 | A new Child starts | Admin | Children → "New Child profile" → details → Save → Parents, contacts, Alerts, Consents, Group | 10+ |
| 10 | A new colleague | Admin | Staff accounts → email, Role → "Create account"; the colleague sets a password from the email | 3 |
| 11 | Something is not working | anyone | "Feedback" (bottom of every page) → type, text → Send | 3 |

The screens in `screens/` show the pages these flows pass through.
