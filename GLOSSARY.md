# Kita Kids Database

The language of a kindergarten (Kita) whose staff keep children's profiles, safety data, groups and daily operations in one local-network app.

## People

**Child**:
A child cared for by the Kita, with a profile kept by Admins.
_Avoid_: Kid, pupil, student

**Parent**:
A contact person recorded for one or more Children; not someone who logs in.
_Avoid_: Guardian (unless the law requires the distinction), user

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
