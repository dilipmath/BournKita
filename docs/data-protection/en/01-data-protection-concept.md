# Data-protection concept: Kita Kids Database

Kita: ______________________  Carrier: ______________________  Version: draft of Release 1  Date: ____________

## 1. Purpose

The Kita Kids Database helps the Kita's Staff members keep Children's profiles, safety data (allergies, conditions, who may pick up, whom to call), Groups and the day's work (attendance, tasks, calendar, Incidents) in one place, instead of paper folders and spreadsheets. It serves the care of the Children and their safety, above all in emergencies.

## 2. Whose data, and which

| Who | Data | Stored encrypted |
|---|---|---|
| **Children** | First and last name, gender, languages spoken, food preferences, interests, date of birth, Group | no |
| | Allergies and medical conditions (Alerts): what it is, what to do | **yes** |
| | Photos (gallery), shown only with photo Consent | **yes** (files) |
| | Consents (photos, excursions, data protection): given on, withdrawn on | no |
| | Attendance: checked in and out (times, per day) | no |
| | Absences: from, until | no |
| | Absence reason (sick, holiday, other) | **yes** |
| | Incidents: day, time, who reported it | no |
| | Incidents: what happened, who was informed; Follow-ups (and who wrote them) | **yes** (texts) |
| **Parents** | First and last name; may pick up the Child: yes or no | no |
| | Address, phone, email | **yes** |
| | Photo (as a Pick-up person; no Consent asked) | **yes** (file) |
| **Emergency contacts and Pick-up persons** | Name, relationship (e.g. grandmother) | no |
| | Phone, note | **yes** |
| | Photo (Pick-up persons; no Consent asked) | **yes** (file) |
| **Staff members** | Email address, Role, the Groups they work in, account status | no |
| | Password (only as an Argon2 hash; never readable) | hashed |
| | Sessions (last activity) and failed logins (for the lockout) | no |
| | What they viewed or changed: the Audit log, with their email address | no |
| | Feedback they sent: the text | **yes** |
| | Feedback they sent: their email address, the page it came from | no |
| | Tasks assigned to them | no |
| **Anyone named in free text** | Titles and notes of Tasks and Events, typed freely by Staff members (may name a Child) | no |

Encryption uses AES-256-GCM with a key kept apart from the database (`KITA_ENCRYPTION_KEY`); each value is bound to its record, so copying it elsewhere makes it unreadable. In addition, the server's disk is to be encrypted (H4).

**On paper:** the Emergency list (PDF) shows the Children present, their Alerts and whom to call, with phone numbers. Printed, it leaves the app's protection (see 9).

**Special categories (GDPR Art. 9):** Alerts and an Absence reason "sick" are health data. Food preferences can reveal health (e.g. lactose-free) or religion (e.g. "halal"), and languages can reveal ethnic origin; both are stored unencrypted (see 9).

## 3. Why (legal basis, to be confirmed by the data-protection officer)

Which law applies depends on the carrier: a municipal carrier is bound by the federal state's data-protection act, a church carrier by church law (KDG for Catholic, DSG-EKD for Protestant carriers), a private one by the GDPR and the BDSG; for all, the social-data rules of SGB VIII (§§ 61–65) apply to youth welfare services. See 04, section 1. The bases below are candidates only.

| Data | Purpose | Candidate basis |
|---|---|---|
| Child profiles, Parents, Groups, Attendance, Absences | Care under the childcare contract and the state Kita law | Art. 6(1)(b) and (c), state Kita law, SGB VIII |
| Alerts (health) | Protecting the Child's health | explicit consent (Art. 9(2)(a)) or a basis in state law; in an emergency Art. 9(2)(c) |
| Emergency contacts, Pick-up persons, their photos | Reaching someone; handing the Child only to those allowed | Art. 6(1)(b); photos of adults: their consent |
| Children's photos | Gallery for the Parents and the Kita | Art. 6(1)(a): Consent, which can be withdrawn at any time |
| Incidents and Follow-ups | Duty to document accidents (e.g. for the accident insurer) | Art. 6(1)(c) |
| Audit log | Proving who accessed which data | Art. 5(2), Art. 32 |
| Staff accounts | Logging in, Roles | employment law; § 26 BDSG is in doubt since the EU court's ruling C-34/21 |

## 4. Who sees what

| Role | Sees and does |
|---|---|
| **Admin** (Kita manager, deputy) | Everything; changes Child profiles and Parents; manages Staff accounts, the archive, the Audit log, Feedback, data exports and deletions; adds Follow-ups to Incidents |
| **Teacher** | Reads the full Child profiles of all Children: Alerts, Parents with address, phone and email, contacts, photos, Consents. Records Attendance and Absences; adds and changes Events and Tasks; reports Incidents and sees the ones they reported; prints the Emergency list |
| **Guest** | Only the whole Kita's Events and the Holidays. The app gives a Guest no personal data from its records; but Event titles and notes are typed freely, so a Guest sees whatever Staff write into a Kita-wide Event |
| **Nobody outside the Kita** | The app runs on the Kita's own server, reachable only inside its network, over HTTPS. No cloud, no port opened to the internet. |

What leaves the app:
- **Emails, through the Kita's mail provider** (a processor; agreement under Art. 28 needed):
  - to Staff members: invitations and password resets (with a link to set a password), Reminders (an Event's title, note, day and Group);
  - to the developer, or the crash-report address if no Feedback address is set: Feedback (the type, the text as typed, the page, the sender's email address) and crash reports;
  - crash reports carry no names, texts or addresses, only where in the code something failed; failed backups are reported the same way.
- **If no mail server is set up**, the app writes every email, links and Feedback text included, into the server's log instead. The server log then needs the same protection (see 9).
- **The developer**, if not part of the Kita: needs a processor agreement or a confidentiality undertaking, as Feedback may hold what Staff typed.
- **Parents, on request:** an export of their own and their Children's data (Data-access request, Art. 15). Other Parents appear in it by name only, Staff members by Role only.
- **On paper:** printed Emergency lists (see 2).

## 5. Protection (technical and organisational measures)

- Only inside the Kita's network; HTTPS with the Kita's own certificate authority; no port forwarding.
- Logins: email and password (at least 12 characters, hashed with Argon2); 5 failed logins in a row lock the account for 15 minutes; sessions end after 30 minutes without activity; cookies are Secure, HttpOnly and SameSite=Strict.
- Roles (Admin, Teacher, Guest), checked on every request; Guests are refused everywhere unless a page is meant for them.
- Field encryption (see 2), photos encrypted on disk, server disk encryption (H4).
- Audit log of every view of a Child's profile and every change of a Child's data, naming the fields, never their values. Lists of names and searches are not recorded.
- Photos shown only while photo Consent is given; withdrawing it hides them at once (the files are kept, see 9).
- Crash reports without personal data.
- Backups: nightly to a second drive (readable by root only; the drive to be encrypted), weekly encrypted with age for off-site, the private key kept apart. A test in the development pipeline restores both kinds into a fresh database on every change to the app; the Kita should also try a restore of its own backups now and then.
- Organisational: Admin accounts only for those who need them; Staff accounts deactivated when someone leaves; the encryption key and the backup key printed and locked away; screen lock on every tablet; Staff members trained (H7).

## 6. How long

| Data | Kept until | Decision |
|---|---|---|
| A Child's profile and all its data | Deleted by an Admin → archive for **12 months** (placeholder) → deleted for good, with its photos and the Parents left with no Child | ☐ see 04 |
| Attendance and Absences of a current Child | As long as the Child is at the Kita (no limit) | ☐ see 04 |
| Incidents | With the Child (archive, then deleted) | ☐ check the insurer's duty to keep them |
| Photos after photo Consent is withdrawn | Hidden at once, but kept until the Child is purged | ☐ see 04 |
| A Parent's data on a Deletion request | Deleted for good at once: the Parent, **all** their Children (current and archived, with Incidents), and the Children's other Parents left with no Child | ☐ see 04 |
| Tasks and Events (titles and notes) | No limit; not deleted with a Child | ☐ see 04 |
| Audit log | No limit; entries keep the Staff member's email address and, once the data is gone, the Child's or Parent's number | ☐ see 04 |
| Feedback | No limit | ☐ see 04 |
| Staff accounts | Deactivated, never deleted (so the Audit log can name them) | ☐ see 04 |
| Server logs | Docker's own log files on the server, no limit set | ☐ see 04 |
| Sessions, links in emails | Sessions end after 30 minutes without activity; links work 7 days (invitation) or 1 hour (password reset) | — |
| Backups | The last 14 nightly backups (about two weeks) and the last 8 weekly ones (about two months); deleted data stays in them that long | ☐ see 04 |

## 7. Rights of the people concerned

- **Access (Art. 15):** an Admin exports everything held about a Parent and their Children (ZIP with all data and photos) from the Parent's page.
- **Erasure (Art. 17), the Deletion request:** an Admin deletes a Parent's data for good from the Parent's page, at once, with **all** their Children (see 6); it is recorded in the Audit log without the data.
- **Rectification (Art. 16):** Admins correct profiles at any time.
- **Withdrawal of consent:** recorded with its date; photos are hidden at once (but kept, see 9).

## 8. Data breaches

A suspected breach (a lost device, the wrong person had access) goes to the Kita manager and the data-protection officer at once. A reportable breach must reach the supervisory authority within 72 hours (Art. 33); where it is likely to put people at high risk, they must be told too (Art. 34). The Audit log shows who viewed which Child's profile.

## 9. Open points

1. Food preferences and languages are unencrypted, though they can reveal health, religion or ethnic origin. ☐
2. Names of Emergency contacts and Pick-up persons are unencrypted. ☐
3. Teachers see all Children's full profiles, Parents' addresses included, not only those of their Groups. ☐
4. Photos stay stored after photo Consent is withdrawn (Art. 17(1)(b) may require deleting them). ☐
5. A Deletion request by one Parent deletes all their Children, including the other Parent's link and the Incident records. ☐
6. Tasks and Events have no retention limit, and their free text may name Children. ☐
7. Printed Emergency lists: where they are kept, and how they are destroyed. ☐
8. Server logs: how long they are kept, and that they hold email bodies when no mail server is set. ☐
9. The retention periods marked ☐ in 6. ☐
10. Processor agreements with the mail provider and, if external, the developer. ☐
11. Screen lock on every tablet. ☐
