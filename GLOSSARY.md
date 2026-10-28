# Kita Kids Database

The language of a kindergarten (Kita) whose staff keep children's profiles, safety data, groups and daily operations in one local-network app.

## People

**Child**:
A child cared for by the Kita, with a profile kept by Admins.
_Avoid_: Kid, pupil, student

**Child profile**:
What the Kita records about one Child: name, gender, languages spoken, food preferences, interests, Alerts and the other safety data below. Admins keep it; every Staff member can read it.
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
The page a Staff member lands on after picking a Group: that Group's Children with their Alerts, and later its day.
_Avoid_: Group page, overview

**Staff member**:
Any Kita employee who has a login.
_Avoid_: User, employee, teacher (as a kind of person)

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
A read-only Role that never sees personal data.
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

**Audit log**:
The record of who viewed, created, changed or deleted which Child's data, and when. For a change it names the fields, never their old or new values. Only Admins read it, and nobody edits it.
_Avoid_: History, activity log, Protokoll (in code and docs)
