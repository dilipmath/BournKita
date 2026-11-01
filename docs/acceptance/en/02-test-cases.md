# Test cases

Work through them in order: part A sets up the made-up data that part B uses. Tick each case ✓ (works as written), ✗ (does not work, or not as written) or ~ (works, but something is odd or hard), and write a word in "Note". Every ✗ and ~ goes into the findings log (`03`). The R numbers are those of the Release 1 scope (H1).

Names in quotes are the app's buttons and pages, as they read in English; the German version of this sheet uses the German ones.

Tester(s): ______________________  Tablet: ____________  Date: ____________

## A. Setting up (Admins, about 1 hour)

| # | R | Do | Expected | ✓ ✗ ~ | Note |
|---|---|---|---|:-:|---|
| A1 | R01, R04 | On a tablet, open `https://kita.home.arpa`. Log in with the Kita manager's account. | No certificate warning. The start page shows. | | |
| A2 | R35 | Choose "Deutsch", reload the page, then choose "English" again (or the other way round). | All text switches; the choice stays after the reload. | | |
| A3 | R02, R03 | "Staff accounts": create an account for each tester (Role Teacher, one more Admin if wanted) and one for the Guest (Role Guest). | Each shows "Invited – email not verified yet"; each tester gets an invitation email. | | |
| A4 | R02 | Each tester opens their invitation email, follows the link and chooses a password (at least 12 characters). | "Your password is saved"; the account shows "Active". | | |
| A5 | R10 | "Groups": create "Monkeys" (icon Monkey) and "Butterflies" (icon Butterfly). Rename "Butterflies" to "Bees". | Both show with their icon; the new name shows everywhere. | | |
| A6 | R10 | "Staff accounts": tick the Monkeys for each Teacher. | Saved; each Teacher works in the Monkeys. | | |
| A7 | R06 | "Children" → "New Child profile": Lena Weber (girl, born 14.03.2022, languages German and Turkish, vegetarian, likes painting). On her profile, choose the Group Monkeys. The same for Noah Fischer, Mia Schmidt, Sofia Wagner, and Emil Becker **born on today's date four years ago**. | Each profile shows what was entered and the Group; the Monkeys' page lists all five. | | |
| A8 | R06 | Edit Lena: change her interests. | The change shows. | | |
| A9 | R09 | Lena → "Parents" → "Add Parent": Anna Weber, an address, a phone number. Create Ben Weber (Monkeys) and link the same Anna Weber to him ("Find a recorded Parent"). | Anna shows on both profiles; changing her phone on one shows on the other. | | |
| A10 | R18 | Lena: "Add allergy or medical condition": Allergy, Peanuts, "Epinephrine pen in the office". Noah: Medical condition, Asthma, "Inhaler in his bag". | A red banner at the top of each profile. | | |
| A11 | R19 | Lena: "Add emergency contact" (Erika Weber, grandmother, a phone number) and "Add pick-up person" Tom Krause (neighbour) **with a photo** taken on the tablet. | Both show; Tom with his photo. | | |
| A12 | R22 | Lena: "Consents" → record the photo and the data-protection Consent, given today. Noah: record the excursion Consent only. | Lena: photos and data protection "given since" today; Noah: photos "not given". | | |
| A13 | R06, R22 | Lena: "Add photo" (a toy, not a Child). Look at Noah's photos. | Lena's photo shows in her gallery, quickly. Noah: "No photo Consent: photos are not shown or taken.", and no "Add photo". | | |
| A14 | R22 | Lena: record the withdrawal of her photo Consent today. Look at her gallery. Then record it given again. | After the withdrawal her photos are hidden at once; after giving it again they are back. | | |
| A15 | R13 | "Calendar" → "Holidays": import the region's public holidays, then its school holidays (two .ics files). | "… holidays imported"; they show in the Calendar on their days. | | |

## B. Everyday (Teachers on tablets, about 2 hours)

Each Teacher logs in on a tablet with their own account. Admins may watch, or run the cases marked Admin.

| # | R | Who | Do | Expected | ✓ ✗ ~ | Note |
|---|---|---|---|---|:-:|---|
| B1 | R15, R33 | Teacher | Add the app to the tablet's home screen (browser menu → "Add to Home screen" / "Install app"), open it from there. | It opens like an app, without the browser's address bar. | | |
| B2 | R10 | Teacher | On the start page, choose the Monkeys. | The Monkeys' page: today's date, the counts, every Child of the Group. | | |
| B3 | R18 | Teacher | Which Children have an Alert? | Lena and Noah carry the "Alerts" marker. | | |
| B4 | R24 | Teacher | Whose birthday is it? | "Birthday today: Emil Becker". | | |
| B5 | R21 | Teacher | "Check in" Emil, Lena and Noah. Then "Check out" Lena. Then "Undo" for Lena. | The counts and each Child's line change each time ("Here since …", "Gone home at …"); after Undo Lena is here again. | | |
| B6 | R21 | Teacher | Sofia: "Absent", reason Sick, from tomorrow until the day after. | Her absence shows on her profile under "Absences". | | |
| B7 | R18, R19 | Teacher | Open Lena's profile. | The Alerts banner at the top; her allergy next to her food preferences; "Who may pick up" shows Tom Krause with his photo. | | |
| B8 | R06 | Teacher | Is there a way for you to change or delete Lena's profile? | No: no "Edit" or "Delete" button for a Teacher. | | |
| B9 | R06 | Teacher | "Children": search for "we". | Lena and Ben Weber are found. (By Group: the Group's page, B2.) | | |
| B10 | R23 | Teacher | Noah: "Report incident": grazed his knee on the slide, plaster, father informed by phone. | "Incident reported."; it cannot be changed afterwards. | | |
| B11 | R23 | Admin | "Incident log": find Noah's incident, "Add follow-up". | The follow-up shows under the incident, with who wrote it and when. A Teacher's "Incident log" shows only their own reports. | | |
| B12 | R20 | Teacher | It is a fire drill: the Monkeys' "Emergency list (PDF)". Print it on the office printer. Then the start page's "Emergency list of the whole Kita (PDF)". | Lists the Children here now (Emil, Lena, Noah; not Ben, Mia or Sofia), with their Alerts and whom to call; readable on paper. | | |
| B13 | R12 | Teacher | "Task board": "Add task" "Buy glue sticks". Drag it with a finger to Doing, then to Done. | It moves each time and stays there after a reload. | | |
| B14 | R12 | Teacher | Add three more tasks; with "Edit", give one an assignee ("Who does it"), a due date and a label. "Backlog": move the most important to the top (drag it, or "Up"). | The order and the details stay after a reload. | | |
| B15 | R13 | Teacher | Monkeys' "Calendar" → "Add event": puppet show the day after tomorrow, 10:00–11:00, reminder "1 day before". Look at Month, Week and Agenda. | It shows the day after tomorrow at 10:00 in all three views; the month also shows the holidays and Emil's birthday (today). | | |
| B16 | R13 | Teacher | "Add event": morning circle every Monday, 09:00–09:30, repeating every week. Then "Edit" it to start at 09:15, then "Delete" it. | It shows on every Monday, then at 09:15; after deleting, on no Monday. | | |
| B17 | R13 | Admin | "Calendar" for the whole Kita: "Add event" "Parents' evening", For: Whole Kita. | Shows in the whole Kita's Calendar and in every Group's. | | |
| B18 | R16 | Teacher | "Feedback" (on any page): kind Idea, "This is a test". | "Thank you! Your feedback was sent."; the developer gets the email with the page. | | |
| B19 | R01 | Guest | Log in with the Guest account. Look around. | Only the Calendar, read-only, with the Kita-wide events and holidays; no Child, no Group's events, no name; no Birthdays. | | |
| B20 | R01, R03 | Teacher | In the browser (not the installed app), try to open the Staff accounts, Audit log and Archive (they are not in the menu; ask the Admin for the addresses `/staff`, `/audit-log`, `/archive`). | "Only Admins can …" each time. | | |
| B21 | R02 | Teacher | Log out. "Forgot your password?": ask for a link, follow it from the email, choose a new password, log in with it. | Works; the old password no longer does. | | |
| B22 | R01 | Teacher | Leave the tablet untouched for 30 minutes, then tap something. | The app asks for the login again. | | |
| B23 | R01 | Teacher | Log out. Log in with a wrong password 5 times in a row, then with the right one. | The right password is refused too, for 15 minutes (the app explains the lockout); a new password (B21's way) unlocks it at once. | | |

### Admin cases

| # | R | Do | Expected | ✓ ✗ ~ | Note |
|---|---|---|---|:-:|---|
| B24 | R03 | "Staff accounts": change a Teacher to Admin and back. Deactivate one Teacher's account while they are logged in. | The roles change; the deactivated Teacher is out at their next tap and cannot log in again. "Reactivate" lets them back. The Audit log still shows what they did. | | |
| B25 | R08 | Delete Sofia's profile ("Delete", then "Delete profile"). Open "Archive". Restore her. | Sofia is gone from the Children and the Monkeys, shows in the Archive with the date she will be purged, and is back with all her data after restoring. | | |
| B26 | R34 | "Audit log": filter by a Teacher, then open "Audit log for this Child" on Lena's profile. | Shows who viewed and changed Lena's data, and when. | | |
| B27 | R34 | Anna Weber's page (her name on Lena's profile) → "Export all data (ZIP)". Open the ZIP on a laptop. | It holds Anna's, Lena's and Ben's data and Lena's photos. | | |
| B28 | R34 | On Anna Weber's page, "Delete all data" → "Delete permanently". | Anna, Lena and Ben are gone for good, also from the Archive and the Today view; the Audit log shows "Parent no. …" "For good". | | |

## C. The next morning (developer or IT)

| # | R | Do | Expected | ✓ ✗ ~ | Note |
|---|---|---|---|:-:|---|
| C1 | R04 | `dc logs --tail 20 backup` | "Nightly backup … done." from 01:30. | | |
| C2 | R24 | The Teachers of the Monkeys check their email the next morning (the day before the puppet show), from 07:00. | Each gets one Reminder email. | | |
| C3 | R04 | `journalctl -u kita-health-check --no-pager \| tail` | "all well" (or only expected warnings, e.g. no off-site drive yet). | | |
| C4 | R04 | On a phone using mobile data (Wi-Fi off), open `https://kita.home.arpa`. | It does not open: the app is reachable only inside the Kita. | | |
