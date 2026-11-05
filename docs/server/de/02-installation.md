# Den Server einrichten

Für die Person, die ihn einrichtet: etwas Linux-Erfahrung hilft. Etwa ein halber Tag. Befehle laufen auf dem Server als Admin-Benutzer, mit `sudo`; alles in `<spitzen Klammern>` ersetzen. Ein Notizbuch für Passphrasen und Schlüssel führen und danach wegschließen (siehe Betriebshandbuch).

Die Namen unten: Der Server heißt `kita`, erreichbar als `kita.home.arpa` (gern ein anderer Name in `.home.arpa`; nie `.local`), der Admin-Benutzer heißt `kitaadmin`, die App liegt in `/opt/kita`.

## 1. Ubuntu Server mit verschlüsselter Festplatte

1. **Ubuntu Server LTS** (die neueste Langzeitversion) herunterladen und auf einen USB-Stick schreiben.
2. In der Firmware des Servers (BIOS/UEFI): von USB starten; „**Einschalten nach Stromausfall**“ (power on after AC power loss) auf *an* stellen, damit er nach einem langen Ausfall wieder startet.
3. Installieren mit diesen Einstellungen:
   - Netzwerk: Kabel, DHCP (in Schritt 2 festgelegt).
   - Speicher: *Use an entire disk*, *Set up this disk as an LVM group*, **Encrypt the LVM group with LUKS**. Eine lange Passphrase wählen und aufschreiben: Sie wird bei **jedem Start** des Servers gebraucht.
   - Profil: Servername `kita`, Benutzer `kitaadmin`, ein starkes Passwort.
   - **Install OpenSSH server**: ja. Keine zusätzlichen Snaps.
4. Neu starten, Festplatten-Passphrase eingeben, anmelden und aktualisieren: `sudo apt update && sudo apt full-upgrade -y && sudo reboot`.

## 2. Feste Adresse und Name, keine Portweiterleitung

Im Router (mit der Person, die ihn betreut):

1. Dem Server eine **feste Adresse** geben (DHCP-Reservierung für seine Netzwerkkarte), z. B. `192.168.1.10`.
2. Einen **lokalen DNS-Namen** anlegen: `kita.home.arpa` → diese Adresse.
3. Prüfen, dass die Liste der **Portweiterleitungen leer** ist (nichts aus dem Internet erreicht das Kita-Netz).

Von einem Laptop in der Kita prüfen: `ping kita.home.arpa`.

## 3. SSH nur mit Schlüsseln

Auf dem Laptop der Admin: `ssh-keygen -t ed25519` (falls noch kein Schlüssel da ist), dann `ssh-copy-id kitaadmin@kita.home.arpa`. Prüfen, dass `ssh kitaadmin@kita.home.arpa` ohne Passwort anmeldet.

Dann auf dem Server die Anmeldung mit Passwort abschalten:

```
sudo tee /etc/ssh/sshd_config.d/10-kita.conf > /dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sudo systemctl restart ssh
```

Die erste Sitzung offen lassen und prüfen, dass eine **neue** `ssh`-Anmeldung noch geht, bevor sie geschlossen wird.

## 4. Firewall

```
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.0.0/16 to any port 22 proto tcp   # SSH nur aus dem Kita-Netz (an das eigene Netz anpassen)
sudo ufw allow 80,443/tcp                                     # die App
sudo ufw enable
sudo ufw status
```

Docker öffnet die Ports der App (80, 443) selbst, an ufw vorbei; das ist in Ordnung, weil der Router nichts aus dem Internet weiterleitet (Schritt 2). Keinen anderen Port freigeben.

## 5. E-Mail für Warnungen

Der Server verschickt Warnungen (fehlgeschlagene Updates, die USV, die tägliche Prüfung) über das Mailkonto der Kita. Das Mail-Passwort kommt in eine eigene Datei, damit alle, die senden, die Einstellungen lesen können:

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
printf %s '<Mail-Passwort>' | sudo tee /etc/msmtp-password > /dev/null
sudo chmod 600 /etc/msmtp-password     # die USV (Schritt 12) darf es auch lesen
echo "root: <ihre-adresse@example.org>" | sudo tee /etc/aliases
printf 'Subject: Kita server test\n\nIt works.\n' | sudo sendmail root
```

Die Test-E-Mail muss ankommen.

## 6. Automatische Sicherheitsupdates

```
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades     # mit Ja antworten
sudo tee /etc/apt/apt.conf.d/52kita > /dev/null <<'EOF'
Unattended-Upgrade::Mail "root";
Unattended-Upgrade::MailReport "only-on-error";
// The disk passphrase is needed at every start, so never restart on its own.
Unattended-Upgrade::Automatic-Reboot "false";
EOF
```

Braucht ein Update einen Neustart, erscheint `/var/run/reboot-required`; zu einer ruhigen Zeit neu starten und die Passphrase eingeben (Betriebshandbuch).

## 7. Docker

```
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker kitaadmin     # danach ab- und wieder anmelden
docker run --rm hello-world
```

## 8. Die Sicherungsplatte (nächtliche Sicherungen)

Anschließen und mit `lsblk` finden (z. B. `/dev/sdb`; **zweimal prüfen**: Sie wird gelöscht). Auch sie wird verschlüsselt und mit einer Schlüsseldatei auf der (verschlüsselten) Systemplatte entsperrt:

```
sudo cryptsetup luksFormat /dev/<sdb>              # eine Passphrase: ebenfalls aufschreiben
sudo dd if=/dev/urandom of=/root/backup-drive.key bs=64 count=1
sudo chmod 400 /root/backup-drive.key
sudo cryptsetup luksAddKey /dev/<sdb> /root/backup-drive.key
sudo cryptsetup open /dev/<sdb> kita-backup --key-file /root/backup-drive.key
sudo mkfs.ext4 -L kita-backup /dev/mapper/kita-backup
echo "kita-backup UUID=$(sudo blkid -s UUID -o value /dev/<sdb>) /root/backup-drive.key luks,nofail" | sudo tee -a /etc/crypttab
sudo mkdir -p /mnt/backup
sudo chattr +i /mnt/backup        # nicht beschreibbar, solange keine Platte eingehängt ist: Sicherungen landen nie auf der Systemplatte
echo "/dev/mapper/kita-backup /mnt/backup ext4 defaults,nofail,x-systemd.before=docker.service 0 2" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /mnt/backup
sudo mkdir -p /mnt/backup/kita
```

## 9. Die Platten für außer Haus (wöchentliche Sicherungen)

**Beide** Platten nacheinander gleich vorbereiten (die wöchentlichen Sicherungen sind schon verschlüsselt, keine Plattenverschlüsselung nötig):

```
sudo mkfs.ext4 -L kita-offsite /dev/<sdc1>      # Namen mit lsblk prüfen; die Platte wird gelöscht
```

Dann einmal:

```
sudo mkdir -p /mnt/offsite
sudo chattr +i /mnt/offsite       # nicht beschreibbar, solange keine Platte steckt
echo "LABEL=kita-offsite /mnt/offsite ext4 defaults,nofail,x-systemd.before=docker.service 0 2" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /mnt/offsite
```

Der wöchentliche Tausch steht im Betriebshandbuch.

## 10. Fotos auf einem Netzlaufwerk (nur wenn gewünscht)

Standardmäßig liegen die Fotos in einem Docker-Volume auf der Platte des Servers und werden nächtlich gesichert. Will die Kita sie stattdessen auf ihrem Netzlaufwerk (NAS), das Laufwerk einhängen und die App darauf zeigen lassen. **Die Datenbank nie auf ein Netzlaufwerk legen.**

```
sudo apt install -y cifs-utils
sudo tee /root/.kita-share > /dev/null <<'EOF'
username=<Benutzer des Laufwerks>
password=<Passwort des Laufwerks>
EOF
sudo chmod 600 /root/.kita-share
sudo mkdir -p /mnt/photos && sudo chattr +i /mnt/photos
```

Nach Schritt 11 (wenn das Image der App gebaut ist) den Benutzer herausfinden, unter dem die App läuft: `cd /opt/kita && docker compose -f compose.prod.yaml run --rm --no-deps api id` (z. B. `uid=999 gid=999`). Dann:

```
echo "//<nas>/<kita-fotos> /mnt/photos cifs credentials=/root/.kita-share,uid=<999>,gid=<999>,file_mode=0600,dir_mode=0700,nofail,_netdev,x-systemd.before=docker.service 0 0" | sudo tee -a /etc/fstab
sudo systemctl daemon-reload && sudo mount /mnt/photos
```

Lief die App schon mit Fotos, diese zuerst auf das Laufwerk kopieren (sonst fehlen sie in der App, und die nächtliche Sicherung verweigert den Lauf):

```
cd /opt/kita && dc stop api backup
docker run --rm -v kita_photos:/from -v /mnt/photos:/to alpine cp -a /from/. /to/
```

Dann `KITA_PHOTO_DIR=/mnt/photos` in `/opt/kita/.env` eintragen und `dc up -d --wait` ausführen. Die Fotos verschlüsselt die App in jedem Fall.

## 11. Die App

```
sudo mkdir -p /opt/kita && sudo chown kitaadmin: /opt/kita
git clone https://github.com/dilipmath/BournKita.git /opt/kita
cd /opt/kita
cp .env.prod.example .env && chmod 600 .env
echo "alias dc='docker compose -f /opt/kita/compose.prod.yaml'" >> ~/.bashrc   # die Abkürzung des Betriebshandbuchs
```

`.env` ausfüllen, wie dort beschrieben: `KITA_HOSTNAME=kita.home.arpa`, `KITA_BACKUP_DIR=/mnt/backup/kita`, `KITA_OFFSITE_DIR=/mnt/offsite`, die Mail-Einstellungen und die beiden Schlüssel (dort steht, wie man sie erzeugt). **Den App-Schlüssel und den privaten Sicherungsschlüssel drucken** und wegschließen. Dann dem Abschnitt „Run in production“ der README folgen: die App starten, die erste Admin anlegen, das Stammzertifikat von Caddy auf jedem Tablet installieren.

Drei Einstellungen machen die App zu der der Kita (alle freiwillig):

- `KITA_NAME=Kita Sonnenschein`: der Name der Kita auf der Anmeldeseite und oben auf jeder Seite. Ohne ihn heißt die App „Kita Kids Database“.
- `KITA_LOGO=logo.png`: ein Logo neben dem Namen. Die Datei in `/opt/kita/branding/` legen. Sie muss ein PNG-, JPEG- oder WebP-Bild sein (kein SVG), am besten quadratisch oder breit, etwa 200 Pixel hoch. Ohne sie, oder bei einer anderen Dateiart, erscheint kein Logo.
- `KITA_CLOSES_AT=16:30`: wann die Kita schließt, in der Zeit der Kita. Danach zeigt die Übersicht der Kita unter „Bitte beachten“ jedes Kind, das noch angemeldet ist. Ohne sie erscheint diese Liste nie.

Nach einer Änderung: `dc up -d`.

## 12. Die USV

Per USB anschließen, dann:

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
  password = <ein Passwort>
  upsmon primary
EOF
sudo tee -a /etc/nut/upsmon.conf > /dev/null <<'EOF'
MONITOR kita-ups@localhost 1 upsmon <dasselbe Passwort> primary
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
# Die USV verschickt ihre E-Mails als Benutzer nut: das Mail-Passwort (Schritt 5) für sie lesbar machen.
sudo chgrp nut /etc/msmtp-password && sudo chmod 640 /etc/msmtp-password
sudo systemctl restart nut-driver-enumerator nut-server nut-monitor
upsc kita-ups          # zeigt den Zustand der Batterie
```

Findet `usbhid-ups` die USV nicht, ihr Modell in der Hardwareliste von NUT nachschlagen. Der Server fährt bei schwacher Batterie sauber herunter; er startet wieder, wenn der Strom zurück ist (Schritt 1), und wartet auf die Festplatten-Passphrase.

## 13. Überwachung

```
sudo cp /opt/kita/server/kita-health-check.service /opt/kita/server/kita-health-check.timer /etc/systemd/system/
sudo sed -i 's/change-me@example.org/<ihre-adresse@example.org>/' /etc/systemd/system/kita-health-check.service
sudo systemctl daemon-reload
sudo systemctl enable --now kita-health-check.timer
sudo systemctl start kita-health-check.service && journalctl -u kita-health-check --no-pager | tail
```

Jeden Morgen um 07:15 prüft sie die Platten, die Dienste der App, die Sicherungsplatte, die Platte für außer Haus, das Fotolaufwerk (falls genutzt), die Sicherung der Nacht, die USV und ob Updates auf einen Neustart warten, und schreibt an die Adresse oben („Kita server kita: needs attention“), wenn etwas nicht stimmt. Fehlgeschlagene Sicherungen und Abstürze meldet zusätzlich die App selbst (`KITA_CRASH_REPORT_EMAIL`).

## Checkliste

- [ ] Ubuntu Server installiert, Platte verschlüsselt, Passphrase aufgeschrieben
- [ ] Erreichbar als `kita.home.arpa`; der Router leitet keine Ports weiter
- [ ] SSH nur mit Schlüsseln (Anmeldung mit Passwort abgewiesen)
- [ ] Firewall an
- [ ] Test-E-Mail angekommen
- [ ] Automatische Updates an
- [ ] Docker läuft
- [ ] Sicherungsplatte verschlüsselt und unter `/mnt/backup` eingehängt; Platten für außer Haus vorbereitet und eine unter `/mnt/offsite` eingehängt
- [ ] (Falls gewünscht) Fotolaufwerk unter `/mnt/photos` eingehängt
- [ ] App läuft; erste Admin angelegt; Stammzertifikat auf jedem Tablet
- [ ] Schlüssel gedruckt und weggeschlossen: Festplatten-Passphrase, Passphrase der Sicherungsplatte, App-Schlüssel, privater Sicherungsschlüssel
- [ ] USV: `upsc kita-ups` zeigt sie; ein Test (kurz ausstecken) schickt eine E-Mail
- [ ] Einen langen Stromausfall ausprobiert (die USV ausstecken, bis der Server herunterfährt, dann wieder einstecken): Der Server startet von selbst und fragt nach der Festplatten-Passphrase
- [ ] Überwachung eingeschaltet; ihr erster Lauf meldet „all well“
- [ ] Einmal eine Wiederherstellung ausprobiert (Betriebshandbuch)
- [ ] Das Betriebshandbuch (03) gedruckt und im Büro
