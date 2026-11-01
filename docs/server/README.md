# The Kita server (H4, issue #5)

Everything needed to buy, install and look after the server the app runs on. Each document comes in English (`en/`) and German (`de/`).

| Document (`en/` · `de/`) | For | What it is |
|---|---|---|
| `01-hardware.md` (both) | Whoever buys it | What to buy (server, UPS, backup drives), with a checklist |
| `02-install.md` · `02-installation.md` | Whoever installs it (some Linux experience) | Step by step, with the commands: encrypted Ubuntu Server, SSH keys, fixed address and name, firewall, email for warnings, Docker, the backup drives, the photo share, the app, automatic updates, the UPS, monitoring |
| `03-admin-runbook.md` · `03-betriebshandbuch.md` | The Kita's Admin; **print it and keep it in the office** | One page: what to do after a power cut, a full disk, a warning email, an update, a restore |

Also used: `compose.prod.yaml` and `.env.prod.example` (the app), `backup/` (the backups), `server/health-check` with its systemd timer (the monitoring), and the README's "Run in production" section.

## Afterwards

Tick the checklists at the end of 01 and 02 as you go, and tell Claude when they are done: it then records the outcome on issue #5.
