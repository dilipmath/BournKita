# Data-protection impact assessment (GDPR Art. 35)

## Part A: Is one required?

An impact assessment is required where processing is likely to result in a high risk. The European data-protection authorities' guidance (WP248, endorsed by the EDPB) names nine criteria; meeting **two or more** usually means one is needed. Also check the list of the supervisory authority of the Kita's federal state.

| # | Criterion | Here | Met? |
|---|---|---|:-:|
| 1 | Evaluation or scoring (profiling) | No assessment of Children or Staff members | no |
| 2 | Automated decisions with legal or similar effect | None | no |
| 3 | Systematic monitoring | Attendance times are recorded per day, but for care and safety, not to watch people | ☐ |
| 4 | Sensitive or highly personal data | Health data (Alerts, sickness Absences); food preferences may reveal health or religion, languages ethnic origin | **yes** |
| 5 | Large scale | One Kita (about ___ Children) | no |
| 6 | Matching or combining datasets | No | no |
| 7 | Vulnerable data subjects | Children | **yes** |
| 8 | Innovative technology | A conventional web app; no AI in Release 1 | no |
| 9 | Prevents people from exercising a right or using a service | No | no |

**Result:** at least two criteria (4 and 7) are met, so a formal assessment is **recommended**. Decision in 04.

## Part B: Draft assessment

### 1. Description

See the concept (01): what is stored (section 2), why (3), who sees it (4), how long (6). Release 1 of the Kita Kids Database, on the Kita's own server, used by about ___ Staff members on ___ tablets and ___ PCs.

### 2. Necessity and proportionality

- **Purpose-bound:** each kind of data serves the care or safety of the Children (01, section 3).
- **Data minimisation:** only what the Kita already records on paper; Guests see no personal data; exports name other Parents by name only and Staff by Role only.
- **Storage limitation:** deleted profiles are purged after the retention period; open periods in 04.
- **Rights:** access, erasure, rectification and withdrawal of consent are built in (01, section 7).

### 3. Risks and measures

Likelihood and severity: low, medium, high (after the measures).

| Risk | Measures in place | Likelihood | Severity |
|---|---|:-:|:-:|
| Someone outside the Kita reads the data (internet attack) | Only inside the Kita network, no port forwarding, HTTPS, login with lockout | low | high |
| A lost or stolen tablet is used to read data | Session ends after 30 minutes without activity; tablets need their own screen lock (☐ check) | medium | high |
| The server or a backup drive is stolen | Disk encryption (H4), field encryption, photos encrypted, off-site backups encrypted, keys kept apart | low | high |
| A Staff member looks at data they do not need | Roles; every view recorded in the Audit log; Admins review it | medium | medium |
| Wrong person picks up a Child | Pick-up persons with photos on the profile | low | high |
| Allergy not known in an emergency | Alerts on the profile, the Group, the Today view and the Emergency list | low | high |
| Photos shown without consent | Shown only while photo Consent is given; withdrawal hides them at once | low | medium |
| Data kept longer than needed | Archive with automatic purge; Deletion requests; open periods in 04 | medium | medium |
| Data lost (broken disk, fire) | Nightly and weekly backups, off-site copy; restoring them is tested on every change to the app (with test data), and the Kita tries its own now and then | low | high |
| Data leaves via email | Only Staff members' email addresses, Reminders (an Event's title and note), Feedback (with its page and sender) and crash reports go out; the Feedback form asks not to write names or health details; processor agreement with the mail provider | medium | medium |
| Data visible in the server log | A mail server is set up, so emails are not written to the log; the log is kept on the encrypted server, for a set time (04) | low | medium |
| Printed Emergency lists left lying around | Kept in a set place and shredded after use (04) | medium | medium |
| A Guest sees a Child named in a Kita-wide Event | Staff members told not to name Children in Events | low | low |

### 4. Residual risk

With the measures in place and the open points of the concept (01, section 9) settled, the residual risk is assessed as: ☐ acceptable ☐ not acceptable (then consult the supervisory authority, Art. 36).

### 5. Sign-off

Data-protection officer: ______________________  Date: ____________

Kita manager: ______________________  Date: ____________
