# Kita server: admin runbook

**Print this page and keep it in the office.** The keys it mentions are in the safe, never on this page.

| | |
|---|---|
| Server | `kita.home.arpa` (address: ______________) in: ______________________ |
| Log in from the admin laptop | `ssh kitaadmin@kita.home.arpa` |
| The app | `/opt/kita`; commands below start with `cd /opt/kita` |
| Who to call | IT: ______________________  Developer: ______________________ |
| Keys in the safe | disk passphrase · backup-drive passphrase · app key (`KITA_ENCRYPTION_KEY`) · backup private key (age) |

`dc` below is short for `docker compose -f /opt/kita/compose.prod.yaml` (set up at installation).

## After a power cut or restart

The server waits for the **disk passphrase**: connect a screen and keyboard, type it, wait two minutes. The app starts by itself. Check: open the app on a tablet.

## A warning email arrived

The morning health check's subject is "Kita server kita: needs attention"; its lines say what is wrong:

| It says | Do |
|---|---|
| "disk … % full" | `df -h`; old Docker images: `docker image prune -a`; if the backup drive is full, lower `KITA_BACKUP_KEEP_NIGHTLY` in `.env` and `dc up -d` |
| "service … not well" / "stack not running" | `dc ps`, then `dc up -d --wait`; if it stays unwell: `dc logs --tail 100 <service>` and call the developer |
| "backup drive is not mounted" | Check its cable; `dc stop backup`, `sudo cryptdisks_start kita-backup`, `sudo mount /mnt/backup`, then `dc up -d` |
| "No off-site drive" | Plug one in (see below), `sudo mount /mnt/offsite && dc restart backup` |
| "photo share is not mounted" | Check the NAS is on; `dc stop api backup`, `sudo mount /mnt/photos`, then `dc up -d` |
| "No nightly backup" | `dc logs --tail 50 backup`; usually a drive (above); run one by hand: `dc exec backup run-job nightly` |
| "UPS …" | See the UPS row below |
| "Updates are waiting for a restart" | See Updates below |

Other warnings:

| Subject | Do |
|---|---|
| "Kita crash: BackupFailed in nightly backup" (or weekly backup, backup service) | As "No nightly backup" above; "backup service" means a drive is missing |
| "Kita crash: …" (anything else) | Forward it to the developer |
| "Kita server UPS: … on battery" | Power cut: nothing to do; the server shuts down by itself if it lasts long |
| Unattended upgrade error | Forward it to IT |

## Every week: swap the off-site drive

On the day agreed (after the Sunday backup):

```
dc stop backup && sudo umount /mnt/offsite
```
Unplug the drive, take it home (or to the safe); plug in the other one, then:
```
sudo mount /mnt/offsite && dc start backup
```

Forgotten to start it again, or no drive plugged in? The next morning's health check emails a warning; a backup service started without a drive emails one at once, and again every hour.

## Updates

- Ubuntu updates itself. When `ls /var/run/reboot-required` shows the file: restart at a quiet time (`sudo reboot`) and type the disk passphrase.
- New version of the app: `cd /opt/kita && git pull && dc up -d --build --wait`.

## Staff

- New colleague: in the app, Staff accounts → create (an Admin does it).
- Someone leaves: deactivate their account the same day.

## Restore (data lost or a new server)

Only with the developer or IT on the phone. The steps are in the README, "Restore". You need the app key; from an off-site drive also the backup private key.

## Never

- Forward ports on the router, or put the server's address on the internet.
- Store the keys on the server, a tablet or in email.
- Unplug the server without shutting it down (`sudo shutdown -h now`) unless the UPS is doing it.
