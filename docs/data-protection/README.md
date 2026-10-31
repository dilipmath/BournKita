# Data protection for H2 (issue #3)

Drafts for the Kita's data-protection work, written from what the app actually stores and does (as of Release 1). Each comes in English (`en/`) and German (`de/`).

**These are drafts, not legal advice.** They give the Kita, and its carrier's data-protection officer, a complete and accurate starting point. The Kita must check them, fill in what only it knows, and make the decisions marked ☐.

| Document (`en/` · `de/`) | What it is |
|---|---|
| `01-data-protection-concept.md` · `01-datenschutzkonzept.md` | What is stored, why, who sees it, how it is protected, how long it is kept |
| `02-record-of-processing.md` · `02-verarbeitungsverzeichnis.md` | The record of processing activities (GDPR Art. 30) |
| `03-impact-assessment.md` · `03-datenschutz-folgenabschaetzung.md` | Whether a data-protection impact assessment (Art. 35) is required, and a draft of one |
| `04-decisions.md` · `04-entscheidungen.md` | What the Kita decides and signs: jurisdiction, contact, retention periods, the assessment |

## How to use them

1. Read 01 with the Kita manager; correct anything that does not match how the Kita works.
2. Fill in the blanks in 02 (the Kita's name, carrier, contact, mail provider).
3. Go through 03 with the data-protection officer of the Kita's carrier (or an external one); decide whether the formal assessment is needed.
4. Make and sign the decisions in 04. Until then the app keeps its placeholders (e.g. 12 months in the archive).

## Afterwards

Give the decisions to Claude, which then sets them in the app (e.g. `KITA_ARCHIVE_RETENTION_MONTHS`), turns every change they need into a ticket, records the outcome on issue #3, and updates the open assumptions in #1.
