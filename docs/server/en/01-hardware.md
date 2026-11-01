# Hardware

The app is small: one Kita, a few dozen Children, a handful of tablets. What matters is that it runs quietly for years, survives a power cut and never loses data.

## What to buy

| Item | Recommendation | Why |
|---|---|---|
| **Server** | A fanless or quiet mini PC: 4 or more CPU cores (Intel N100 class or better), **16 GB RAM**, **512 GB NVMe SSD**, wired Gigabit Ethernet, a TPM 2.0 chip, 2+ USB 3 ports | Docker, PostgreSQL and the PDF printing need little; the SSD holds the database and photos; wired network is more reliable than Wi-Fi |
| | Not a NAS, unless it runs Docker on a normal Linux and the database can stay on its own disk | The database must never live on a network share |
| **UPS** (uninterruptible power supply) | A small line-interactive UPS, about 600–900 VA, with a **USB connection** that Linux's NUT supports (most APC, Eaton, CyberPower models) | Keeps the server and router up through short power cuts and shuts the server down cleanly in long ones |
| **Backup drive** (second drive, nightly) | An external USB SSD or HDD of 1 TB, always connected | Nightly backups of the database and photos (the last 14) |
| **Off-site drives** (weekly) | **Two** USB sticks or drives of 128 GB or more, swapped each week | One goes home with a trusted person while the other is plugged in; the weekly backup is encrypted, so a lost stick reveals nothing |
| **Network cable** | One, from the server to the router or switch | — |
| **Safe or lockable cupboard** | For the printed keys (disk passphrase, app key, backup key) and the off-site drive | Without the keys no backup can be read; with them, anyone can |

Budget, roughly (2026): mini PC 250–400 €, UPS 100–150 €, drives 100–150 €. About 450–700 € in all.

## Where it goes

- A cupboard or office with power, a network cable to the router, some air, out of reach of Children, not on the floor (water).
- The UPS powers the server **and** the router, so the tablets keep working through a short cut.

## Checklist

- [ ] Server bought (model: ______________________)
- [ ] UPS bought and connected by USB (model: ______________________)
- [ ] Backup drive bought
- [ ] Two off-site drives bought
- [ ] Place chosen: ______________________
- [ ] Safe or lockable cupboard for keys and the off-site drive
