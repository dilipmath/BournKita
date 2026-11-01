# Support and releases

How problems reach the developer, how fast they are answered, and how a new version reaches the Kita.

## Who to ask

| Problem | First | Then |
|---|---|---|
| How do I …? | The manual, the cards, an Admin | — |
| Something in the app is wrong or hard; an idea | **"Feedback"** in the app (it goes to the developer with the page) | — |
| The app does not open at all | The admin runbook: "After a power cut or restart" | IT: ____________ |
| A warning email from the server | The admin runbook: "A warning email arrived" | IT: ____________ |
| A crash email ("Kita crash: …") | Nothing: it went to the developer too | — |
| Data looks wrong, or someone saw what they must not | The Kita manager at once; the Audit log shows who did what | Developer: ____________ |

## How fast

| Kind | Example | Answer | Fix |
|---|---|---|---|
| **Urgent** | The app is down; wrong safety data (allergies, pick-up persons); a data leak | Same working day, by phone | As soon as possible; a workaround the same day (paper fallback) |
| **Normal** | A bug with a detour | Within 3 working days | In the next release |
| **Wish** | A change request, an idea | Within 2 weeks | Planned with the Kita manager (Release 2 list) |

Contact: developer ____________ (phone, email); available ____________.

## What happens to Feedback

The developer reads each Feedback, records it as an issue on GitHub (without names of Children), and answers who sent it. Every month or so the developer and the Kita manager go through the open issues and decide what comes next.

## Releases

A release is a new version of the app, tested and installed at a fixed time. `dc` below is short for `docker compose -f /opt/kita/compose.prod.yaml` (as in the admin runbook).

1. **Built and tested** by the developer: every change goes through the automatic tests (CI), including the backup restore test. A release is only made when they all pass.
2. **Named:** the version in `backend/pyproject.toml` and `frontend/package.json` goes up (e.g. 1.0.0 → 1.1.0; 1.0.1 for fixes only), and the commit is tagged on GitHub (`v1.1.0`) with a short list of what changes, in English and German, for the Kita, saying whether it changes the database.
3. **Agreed:** the Kita manager gets the list and agrees a quiet time (not during drop-off or pick-up).
4. **Installed** by IT or the developer, at that time:

   ```
   dc exec backup run-job nightly                 # a fresh backup first
   cd /opt/kita && git fetch --tags && git checkout v1.1.0
   dc up -d --build --wait                        # the app is down for about a minute
   ```

   Then open the app on a tablet and look at a Child profile and the emergency list.
5. **Gone wrong?** Back to the previous tag: `git checkout v1.0.0 && dc up -d --build --wait`. If the release notes say the new version changed the database, that is not enough: with the developer on the phone, check out the previous tag, run `dc build`, then follow the README's "Restore" steps with the backup from step 4 (`restore <its date>`, not `latest`, if a nightly backup has run since).
6. **Told:** the Staff hear what changed; for a big change, a short training (`03`).

Urgent fixes follow the same steps, just sooner. Ubuntu's security updates install themselves (runbook, "Updates").

## Reviewed

The Kita manager and the developer look at this sheet once a year, and whenever the contacts change.
