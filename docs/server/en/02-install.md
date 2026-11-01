# Installing the server

For whoever installs it: some Linux experience helps. About half a day. Commands run on the server as the admin user, with `sudo`; replace everything in `<angle brackets>`. Keep a notebook for the passphrases and keys, then lock it away (see the runbook).

The names used below: the server is `kita`, reached as `kita.home.arpa` (pick another name in `.home.arpa` if you like; never `.local`), the admin user is `kitaadmin`, the app lives in `/opt/kita`.

## 1. Ubuntu Server with an encrypted disk

1. Download **Ubuntu Server LTS** (the newest long-term release) and write it to a USB stick.
2. In the server's firmware (BIOS/UEFI): boot from USB; set "**power on after AC power loss**" to *on*, so it starts again after a long power cut.
3. Install with these choices:
   - Network: wired, DHCP (fixed in step 2).
   - Storage: *Use an entire disk*, *Set up this disk as an LVM group*, **Encrypt the LVM group with LUKS**. Choose a long passphrase and write it down: it is needed at **every start** of the server.
   - Profile: server name `kita`, user `kitaadmin`, a strong password.
   - **Install OpenSSH server**: yes. No extra snaps.
4. Reboot, type the disk passphrase, log in, and update: `sudo apt update && sudo apt full-upgrade -y && sudo reboot`.

## 2. Fixed address and name, no port forwarding

In the router (with whoever manages it):

1. Give the server a **fixed address** (DHCP reservation for its network card), e.g. `192.168.1.10`.
2. Add a **local DNS name**: `kita.home.arpa` → that address.
3. Check the **port forwarding** list is **empty** (nothing from the internet reaches the Kita's network).

Check from a laptop in the Kita: `ping kita.home.arpa`.

## 3. SSH with keys only

On the admin's laptop: `ssh-keygen -t ed25519` (if there is no key yet), then `ssh-copy-id kitaadmin@kita.home.arpa`. Check that `ssh kitaadmin@kita.home.arpa` logs in without the password.

Then, on the server, switch password logins off:

```
sudo tee /etc/ssh/sshd_config.d/10-kita.conf > /dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sudo systemctl restart ssh
```

Keep the first session open and check a **new** `ssh` login still works before closing it.

## 4. Firewall

```
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp   # SSH from the Kita's network only (adjust to yours)
sudo ufw allow 80,443/tcp                                     # the app
sudo ufw enable
sudo ufw status
```

Docker opens the app's ports (80, 443) itself, past ufw; that is fine because the router forwards nothing from the internet (step 2). Do not publish any other port.

## 5. Email for warnings

The server emails warnings (failed updates, the UPS, the daily health check) through the Kita's mail account. The mail password goes in a file of its own, so the settings can be read by everyone who sends:

```
sudo apt install -y msmtp-mta
sudo tee /etc/msmtprc > /dev/null <<'EOF'
defaults
auth on
tls on
tls_trust_file /etc/ssl/certs/ca-certificates.crt
account kita
host <smtp.example.org>
port 587
from <kita@example.org>
user <kita@example.org>
passwordeval "cat /etc/msmtp-password"
account default : kita
aliases /etc/aliases
EOF
sudo chmod 644 /etc/msmtprc
printf %s '<mail password>' | sudo tee /etc/msmtp-password > /dev/null
sudo chmod 600 /etc/msmtp-password     # the UPS (step 12) gets to read it too
echo "root: <you@example.org>" | sudo tee /etc/aliases
printf 'Subject: Kita server test\n\nIt works.\n' | sudo sendmail root
```

The test email must arrive.

## 6. Automatic security updates

```
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades     # answer Yes
sudo tee /etc/apt/apt.conf.d/52kita > /dev/null <<'EOF'
Unattended-Upgrade::Mail "root";
Unattended-Upgrade::MailReport "only-on-error";
// The disk passphrase is needed at every start, so never restart on its own.
Unattended-Upgrade::Automatic-Reboot "false";
EOF
```

When an update needs a restart, `/var/run/reboot-required` appears; restart at a quiet time and type the passphrase (runbook).

## 7. Docker

```
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker kitaadmin     # log out and in again afterwards
docker run --rm hello-world
```

## 8. The backup drive (nightly backups)

Plug it in and find it with `lsblk` (e.g. `/dev/sdb`; **check twice**: this erases it). It is encrypted too, and unlocked by a key file kept on the (encrypted) system disk:

```
sudo cryptsetup luksFormat /dev/<sdb>              # a passphrase: write it down too
sudo dd if=/dev/urandom of=/root/backup-drive.key bs=64 count=1
sudo chmod 400 /root/backup-drive.key
sudo cryptsetup luksAddKey /dev/<sdb> /root/backup-drive.key
sudo cryptsetup open /dev/<sdb> kita-backup --key-file /root/backup-drive.key
sudo mkfs.ext4 -L kita-backup /dev/mapper/kita-backup
echo "kita-backup UUID=$(sudo blkid -s UUID -o value /dev/<sdb>) /root/backup-drive.key luks,nofail" | sudo tee -a /etc/crypttab
sudo mkdir -p /mnt/backup
sudo chattr +i /mnt/backup        # unwritable while no drive is mounted: backups never land on the system disk
echo "/dev/mapper/kita-backup /mnt/backup ext4 defaults,nofail,x-systemd.before=docker.service 0 2" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /mnt/backup
sudo mkdir -p /mnt/backup/kita
```

## 9. The off-site drives (weekly backups)

Prepare **both** drives the same way, one after the other (the weekly backups are encrypted already, so no disk encryption is needed):

```
sudo mkfs.ext4 -L kita-offsite /dev/<sdc1>      # check the name with lsblk; this erases it
```

Then, once:

```
sudo mkdir -p /mnt/offsite
sudo chattr +i /mnt/offsite       # unwritable while no drive is plugged in
echo "LABEL=kita-offsite /mnt/offsite ext4 defaults,nofail,x-systemd.before=docker.service 0 2" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /mnt/offsite
```

Swapping them each week is in the runbook.

## 10. Photos on a network share (only if wanted)

By default the photos stay in a Docker volume on the server's disk, and are backed up nightly. If the Kita wants them on its network drive (NAS) instead, mount the share and point the app at it. **Never put the database on a share.**

```
sudo apt install -y cifs-utils
sudo tee /root/.kita-share > /dev/null <<'EOF'
username=<share user>
password=<share password>
EOF
sudo chmod 600 /root/.kita-share
sudo mkdir -p /mnt/photos && sudo chattr +i /mnt/photos
```

After step 11 (once the app's image is built), find the user the app runs as: `cd /opt/kita && docker compose -f compose.prod.yaml run --rm --no-deps api id` (e.g. `uid=999 gid=999`). Then:

```
echo "//<nas>/<kita-photos> /mnt/photos cifs credentials=/root/.kita-share,uid=<999>,gid=<999>,file_mode=0600,dir_mode=0700,nofail,_netdev,x-systemd.before=docker.service 0 0" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /mnt/photos
```

If the app has run with photos already, copy them onto the share first (otherwise they would vanish from the app, and the nightly backup refuses to run):

```
cd /opt/kita && dc stop api backup
docker run --rm -v kita_photos:/from -v /mnt/photos:/to alpine cp -a /from/. /to/
```

Then add `KITA_PHOTO_DIR=/mnt/photos` to `/opt/kita/.env` and run `dc up -d --wait`. The photos are encrypted by the app either way.

## 11. The app

```
sudo mkdir -p /opt/kita && sudo chown kitaadmin: /opt/kita
git clone https://github.com/dilipmath/BournKita.git /opt/kita
cd /opt/kita
cp .env.prod.example .env && chmod 600 .env
echo "alias dc='docker compose -f /opt/kita/compose.prod.yaml'" >> ~/.bashrc   # the runbook's shortcut
```

Fill in `.env` as it explains: `KITA_HOSTNAME=kita.home.arpa`, `KITA_BACKUP_DIR=/mnt/backup/kita`, `KITA_OFFSITE_DIR=/mnt/offsite`, the mail settings, and the two keys (it says how to make them). **Print the app key and the backup private key** and lock them away. Then follow the README's "Run in production": start the stack, create the first Admin, install Caddy's root certificate on every tablet.

## 12. The UPS

Connect it by USB, then:

```
sudo apt install -y nut
sudo sed -i 's/^MODE=.*/MODE=standalone/' /etc/nut/nut.conf
sudo tee -a /etc/nut/ups.conf > /dev/null <<'EOF'
[kita-ups]
  driver = usbhid-ups
  port = auto
EOF
sudo tee -a /etc/nut/upsd.users > /dev/null <<'EOF'
[upsmon]
  password = <a password>
  upsmon primary
EOF
sudo tee -a /etc/nut/upsmon.conf > /dev/null <<'EOF'
MONITOR kita-ups@localhost 1 upsmon <the same password> primary
SHUTDOWNCMD "/sbin/shutdown -h +0"
NOTIFYFLAG ONBATT SYSLOG+EXEC
NOTIFYFLAG LOWBATT SYSLOG+EXEC
NOTIFYCMD "/usr/local/bin/kita-ups-notify"
EOF
sudo tee /usr/local/bin/kita-ups-notify > /dev/null <<'EOF'
#!/bin/sh
printf 'Subject: Kita server UPS: %s\n\n%s\n' "$*" "$*" | sendmail root
EOF
sudo chmod 755 /usr/local/bin/kita-ups-notify
# The UPS service sends its emails as the user nut: let it read the mail password (step 5).
sudo chgrp nut /etc/msmtp-password && sudo chmod 640 /etc/msmtp-password
sudo systemctl restart nut-driver-enumerator nut-server nut-monitor
upsc kita-ups          # shows the battery's state
```

If `usbhid-ups` does not find the UPS, look its model up in the NUT hardware list. The server shuts down cleanly when the battery runs low; it starts again when power returns (step 1), and waits for the disk passphrase.

## 13. Monitoring

```
sudo cp /opt/kita/server/kita-health-check.service /opt/kita/server/kita-health-check.timer /etc/systemd/system/
sudo sed -i 's/change-me@example.org/<you@example.org>/' /etc/systemd/system/kita-health-check.service
sudo systemctl daemon-reload
sudo systemctl enable --now kita-health-check.timer
sudo systemctl start kita-health-check.service && journalctl -u kita-health-check --no-pager | tail
```

Every morning at 07:15 it checks the disks, the app's services, the backup drive, the off-site drive, the photo share (if used), the night's backup, the UPS, and whether updates wait for a restart, and emails the address above ("Kita server kita: needs attention") when something is wrong. Failed backups and crashes are also emailed by the app itself (`KITA_CRASH_REPORT_EMAIL`).

## Checklist

- [ ] Ubuntu Server installed, disk encrypted, passphrase written down
- [ ] Reached as `kita.home.arpa`; router forwards no ports
- [ ] SSH with keys only (password login refused)
- [ ] Firewall on
- [ ] Test email arrived
- [ ] Automatic updates on
- [ ] Docker running
- [ ] Backup drive encrypted and mounted at `/mnt/backup`; off-site drives prepared and one mounted at `/mnt/offsite`
- [ ] (If wanted) photo share mounted at `/mnt/photos`
- [ ] App running; first Admin created; root certificate on every tablet
- [ ] Keys printed and locked away: disk passphrase, backup-drive passphrase, app key, backup private key
- [ ] UPS: `upsc kita-ups` shows it; a test (unplug it briefly) sends an email
- [ ] A long power cut tried (unplug the UPS until the server shuts down, then plug it in): the server starts again by itself and asks for the disk passphrase
- [ ] Health check enabled; its first run says "all well"
- [ ] A restore tried once (runbook)
- [ ] The runbook (03) printed and in the office
