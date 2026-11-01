# Go-live checklist

Tick every line, in order. The developer or IT runs the server lines (commands from `docs/server`; `dc` = `docker compose -f /opt/kita/compose.prod.yaml`).

## Before the day

| | Who | ✓ |
|---|---|:-:|
| The acceptance test is signed off (`docs/acceptance/04`); every "fix before go-live" is fixed and retested | Kita manager | ☐ |
| The release to go live is tagged (see `05`) and its CI run is green, including the restore test | Developer | ☐ |
| Training held (`03`), still on the made-up data; cards printed and next to the tablets (`02`); manual (`01`) in the office | Admin | ☐ |
| The made-up test data is cleared from the server (`docs/acceptance/01`, "Afterwards") | IT | ☐ |
| The release is installed, as in `05` step 4 | IT | ☐ |
| The first Admin (the Kita manager) is created again; every Staff account is invited | IT, Admin | ☐ |
| A first backup made (`dc exec backup run-job nightly`), then the health check run (`sudo systemctl start kita-health-check.service`); `journalctl -u kita-health-check --no-pager \| tail` says "all well" | IT | ☐ |
| The keys are printed and in the safe: disk passphrase, backup-drive passphrase, app key, backup private key | Kita manager | ☐ |
| Every tablet: certificate installed, the app on the home screen, the language chosen | Admin | ☐ |

## Entering the real data

| | Who | ✓ |
|---|---|:-:|
| Groups and Staff in their Groups | Admin | ☐ |
| Every Child: profile, Group, allergies and conditions, Parents, Emergency contacts, pick-up persons, Consents | Admins (two people check each other's allergies and pick-up persons against the paper files) | ☐ |
| Holidays for the school year imported | Admin | ☐ |

## Verifying the backups (the first night after the real data)

| | Who | ✓ |
|---|---|:-:|
| `dc logs --tail 20 backup` shows "Nightly backup … done." | IT | ☐ |
| The newest dump opens: the command below lists the tables | IT | ☐ |
| A restore tried once on a spare machine (never on the live server): the README's "Restore" steps, a copy of the backup drive's newest backup and the app key; a Child profile is back with its photo | IT | ☐ |
| After the first Sunday: a weekly backup on the off-site drive (`ls /mnt/offsite`); the drive swapped as the runbook says | IT, Admin | ☐ |
| A failed backup reaches someone: `dc exec backup report-failure nightly` emails "Kita crash: BackupFailed in nightly backup" to `KITA_CRASH_REPORT_EMAIL` | IT | ☐ |

```
dc exec backup sh -c 'pg_restore --list "$(ls -1 /backups/db/kita-*.dump | tail -n 1)" | head'
```

## Paper fallback

| | Who | ✓ |
|---|---|:-:|
| Each morning, once Children are checked in, the whole Kita's emergency list is printed and kept by the door (for a power or network failure) | Staff, every day | ☐ |
| The paper files stay until the Kita manager decides the app is trusted (suggested: 4 weeks) | Kita manager | ☐ |

## Go-live day

| | Who | ✓ |
|---|---|:-:|
| Every Staff member logs in once and checks in their Group's Children | All | ☐ |
| The first emergency list printed and checked against the Children present | Admin | ☐ |
| After 1 week: a short talk about what is hard; findings as Feedback or to the developer | Kita manager | ☐ |

Live on: ____________  Kita manager: ______________________  Signature: ______________________
