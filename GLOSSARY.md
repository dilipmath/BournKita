# Kita Kids Database

The language of a kindergarten (Kita) whose staff keep children's profiles, safety data, groups and daily operations in one local-network app.

## People

**Child**:
A child cared for by the Kita, with a profile kept by Admins.
_Avoid_: Kid, pupil, student

**Child profile**:
What the Kita records about one Child: name, date of birth, gender, languages spoken, food preferences, interests, Alerts and the other safety data below. Admins keep it; every Staff member can read it.
_Avoid_: Record, file, Akte

**Parent**:
A contact person recorded for one or more Children, with name, address and contact details; not someone who logs in. Siblings share one Parent record.
_Avoid_: Guardian (unless the law requires the distinction), user, contact (for Parents)

**Emergency contact**:
Someone to call when something happens to a Child, recorded for that Child only.
_Avoid_: Contact person (too broad), Notfallnummer (in code and docs)

**Pick-up person**:
Someone who may take a Child home. A Child's Parents are Pick-up persons unless an Admin says otherwise; others are recorded for that Child only.
_Avoid_: Collector, Abholer (in code and docs), authorised person

**Alert**:
An allergy or a medical condition of a Child that every Staff member must know about: what it is (e.g. peanuts, asthma) and, optionally, what to do. Health data, so stored encrypted.
_Avoid_: Warning, health note, Allergie (in code and docs)

**Consent**:
A Parent's permission for one thing concerning a Child: photos, excursions or data protection. Given on a date and possibly withdrawn on a later one; it can be given again, and every period stays on record. A Child has a Consent only while it is given and not withdrawn.
_Avoid_: Permission, approval, Einwilligung (in code and docs)

**Sibling**:
A Child who shares at least one Parent with another Child of the Kita.
_Avoid_: Brother/sister (as terms in code), family member

**Group**:
A set of Children cared for together, with a name and an icon (e.g. Monkeys). A Child is in at most one Group; a Staff member can work in several.
_Avoid_: Class, room, Gruppe (in code and docs)

**Group dashboard**:
The page a Staff member lands on after picking a Group, also called the Today view: that Group's day at the Kita. Each Child's Attendance or Absence, their Alerts, and today's Birthdays; Staff check Children in and out and record Absences here.
_Avoid_: Group page, overview

**Attendance**:
Whether a Child is at the Kita today: checked in when they arrive and checked out when they leave, each once a day, at the Kita's local time. A mistaken step can be undone. Each day starts afresh.
_Avoid_: Presence list, Anwesenheit (in code and docs), register

**Absence**:
Days a Child will not come, from one day to another, with a reason: sick, holiday (the family's own time off, not a Holiday of the region) or other. A Child who is absent cannot be checked in, and an Absence cannot cover a day the Child was checked in. The coming ones are on the Child profile. The reason is health data, so stored encrypted.
_Avoid_: Leave, sick note, Fehlzeit (in code and docs)

**Incident**:
An accident or other incident involving a Child: the day (and time, if known) it happened, what happened, who was informed, and who reported it. Any Staff member reports one; once saved it is a fixed record that nobody changes or deletes (only the Purge of its Child does). Teachers see the Incidents they reported; Admins see all, in the Incident log. What happened and who was informed are stored encrypted.
_Avoid_: Accident report (Incidents are not only accidents), Unfallbericht (in code and docs), event (an Event is in the Calendar)

**Follow-up**:
An Admin's note on an Incident, added later (e.g. "Parents called back, no doctor needed"). Stored encrypted; like the Incident, never changed.
_Avoid_: Comment, update, Nachtrag (in code and docs)

**Emergency list**:
A printout (PDF) of the Children at the Kita right now (checked in, not yet checked out), for one Group or the whole Kita, with their Alerts and whom to call: their Parents and Emergency contacts. Any Staff member prints it, for an evacuation or to have it on paper when the system or the power is down.
_Avoid_: Evacuation list, Notfallliste (in code and docs)

**Task board**:
A Group's board of Tasks in three columns: To do, Doing and Done. Admins and Teachers can work on every Group's board; it shows that Group's Tasks only.
_Avoid_: Kanban, task list, Aufgabenliste (in code and docs)

**Task**:
A piece of work for a Group's team, with a title and an optional note, in one column of the Task board. It may also say who does it (an Assignee), when it is due and a few labels. New Tasks start in To do, at the end of the Backlog.
_Avoid_: Ticket, to-do item, card (the card is only how a Task is drawn)

**Assignee**:
The Staff member who does a Task: an active one who works in the Task's Group.
_Avoid_: Owner, responsible, Zuständige (in code and docs)

**Backlog**:
A Group's To do Tasks in the order its Staff choose, most important first. A Task's priority is its place in the Backlog; there is no separate priority level.
_Avoid_: Priority list, queue, Warteschlange (in code and docs)

**Event**:
Something on in the Kita, for one Group or the whole Kita: all-day (on one or several days) or timed (on one day, from a start to an end time), at the Kita's local time. It may repeat every few days, weeks, months or years, optionally until a date; changing or deleting a repeating Event changes every time it happens. Each time it happens is an occurrence.
_Avoid_: Appointment, Termin (in code and docs), meeting (for Events in general)

**Calendar**:
The Events of the Kita in month, week and agenda views, with the Holidays and the Children's Birthdays. A Group's Calendar shows its own Events and the whole Kita's, and its Children's Birthdays; the Kita-wide Calendar shows every Event, each Group's marked with its icon, and every Birthday. A Guest's Calendar shows only the whole Kita's Events and the Holidays.
_Avoid_: Schedule, Kalender (in code and docs)

**Holiday**:
A public holiday or school holiday of the Kita's region, on one or several days. An Admin imports them from an iCal file; importing again replaces that kind's. They are the whole Kita's.
_Avoid_: Vacation, Feiertag/Ferien (in code and docs), closing day (the Kita's own closing days are Events)

**Birthday**:
The day a Child turns a year older, worked out from the date of birth on their Child profile; never stored as an Event. The Calendar shows the Child's name and the day only.
_Avoid_: Birthday event, Geburtstag (in code and docs)

**Reminder**:
An email about an Event coming up, which the Event asks for: that morning, or 1, 2 or 7 days before. It goes out from 07:00 at the Kita, once to each active Staff member of the Event's Group (or, for the whole Kita, to every one).
_Avoid_: Notification, alert (Alert is a Child's allergy or condition), Erinnerung (in code and docs)

**Staff member**:
Any Kita employee who has a login.
_Avoid_: User, employee, teacher (as a kind of person)

**Feedback**:
A problem, change request or idea that anyone logged in (Guests too) sends from any page, with that page and who sent it. It is stored and emailed to the developer. The form asks not to name Children or give health details, since it leaves the Kita by email.
_Avoid_: Ticket, bug report (Feedback is not only about bugs), Rückmeldung (in code and docs)

## Access

**Role**:
What a Staff member may do: Admin, Teacher or Guest. A Staff member has exactly one Role.
_Avoid_: Permission level, user type

**Admin**:
The Role that maintains Child profiles, groups and Staff accounts.
_Avoid_: Administrator, manager, Leitung

**Teacher**:
The Role for everyday group work; can view Child profiles but not change them.
_Avoid_: Erzieher (in code and docs), educator

**Guest**:
A read-only Role that never sees personal data: it sees the Kita-wide Calendar only (the whole Kita's Events and the Holidays, no Birthdays, no Group's Events) and changes nothing. A Guest gets no Reminders and is never an Assignee.
_Avoid_: Visitor, anonymous user

**Staff account**:
A Staff member's login, identified by their email address, with a Role and an account status.
_Avoid_: User, login (as a noun for the record)

**Account status**:
Where a Staff account stands: _invited_ (created, email address not verified yet, cannot log in), _active_ (verified, can log in) or _deactivated_ (switched off by an Admin; history kept, cannot log in).
_Avoid_: Enabled/disabled, pending, locked (locking is a different, temporary thing)

**Verification link**:
The link emailed to an invited Staff member for choosing a password, which verifies their email address. It works once and expires.
_Avoid_: Invite code, activation link

**Password reset link**:
The link an active Staff member asks for when they forgot their password; it lets them choose a new one. It works once and expires after an hour.
_Avoid_: Recovery link, reset code

**Lockout**:
A temporary block on logging in to a Staff account after too many failed logins in a row. It ends by itself after the lockout period, or when the Staff member chooses a new password with a Password reset link. Not an account status.
_Avoid_: Ban, suspension, deactivation

## Data protection

**Archive**:
Where a Child profile goes when an Admin deletes it, with all its data (Parents' links, contacts, Alerts, Attendance, Incidents, photos), kept apart from the current Children: an archived Child is in no current view. Only Admins see the archive, and an Admin can restore a Child from it with everything it had. When the Retention period ends, the Purge deletes it for good.
_Avoid_: Trash, recycle bin, soft delete (in docs), Papierkorb (in code and docs)

**Retention period**:
How long an archived Child profile is kept before the Purge: 12 months unless the Kita's data-protection assessment says otherwise (`KITA_ARCHIVE_RETENTION_MONTHS`).
_Avoid_: Storage period, Aufbewahrungsfrist (in code and docs)

**Purge**:
Deleting, for good, an archived Child whose Retention period has ended: the profile, all its data and photo files, and its Parents who have no other Child. It cannot be undone. A job does it by itself.
_Avoid_: Cleanup, hard delete (a Deletion request is done at once, on request)

**Data-subject request**:
A Parent's request about the data the Kita holds on them and their Children: a Data-access request or a Deletion request. An Admin answers both from the Parent's page.
_Avoid_: DSGVO request, Betroffenenanfrage (in code and docs)

**Data-access request**:
A Parent's request to see everything the Kita holds about them and their Children. An Admin answers it with an export from the Parent's page: a ZIP file with all the data (data.json) and the photos, archived Children included.
_Avoid_: Auskunftsersuchen (in code and docs), data dump

**Deletion request**:
A Parent's request to delete everything the Kita holds about them and their Children. An Admin does it at once from the Parent's page: the Parent and their Children (current and archived) go for good, with all data and photo files, and so do the Children's other Parents who are left with no Child. Unlike the Archive it cannot be undone; the Audit log keeps that it happened, not the data.
_Avoid_: Hard delete (in docs), erasure, Löschantrag (in code and docs)

**Audit log**:
The record of who viewed, created, changed or deleted which Child's data, and when. For a change it names the fields, never their old or new values. Only Admins read it, and nobody edits it.
_Avoid_: History, activity log, Protokoll (in code and docs)
