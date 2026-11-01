# Kita-Server: Betriebshandbuch

**Diese Seite drucken und im Büro aufbewahren.** Die genannten Schlüssel liegen im Tresor, nie auf dieser Seite.

| | |
|---|---|
| Server | `kita.home.arpa` (Adresse: ______________) in: ______________________ |
| Anmelden vom Admin-Laptop | `ssh kitaadmin@kita.home.arpa` |
| Die App | `/opt/kita`; die Befehle unten beginnen mit `cd /opt/kita` |
| Wen anrufen | IT: ______________________  Entwickler: ______________________ |
| Schlüssel im Tresor | Festplatten-Passphrase · Passphrase der Sicherungsplatte · App-Schlüssel (`KITA_ENCRYPTION_KEY`) · privater Sicherungsschlüssel (age) |

`dc` unten ist die Abkürzung für `docker compose -f /opt/kita/compose.prod.yaml` (bei der Einrichtung angelegt).

## Nach einem Stromausfall oder Neustart

Der Server wartet auf die **Festplatten-Passphrase**: Bildschirm und Tastatur anschließen, eingeben, zwei Minuten warten. Die App startet von selbst. Prüfen: die App auf einem Tablet öffnen.

## Eine Warn-E-Mail ist gekommen

Der Betreff der morgendlichen Prüfung ist „Kita server kita: needs attention“; ihre Zeilen sagen, was nicht stimmt:

| Darin steht | Tun |
|---|---|
| „disk … % full“ | `df -h`; alte Docker-Images: `docker image prune -a`; ist die Sicherungsplatte voll, `KITA_BACKUP_KEEP_NIGHTLY` in `.env` verkleinern und `dc up -d` |
| „service … not well“ / „stack not running“ | `dc ps`, dann `dc up -d --wait`; bleibt es so: `dc logs --tail 100 <Dienst>` und den Entwickler anrufen |
| „backup drive is not mounted“ | Kabel prüfen; `dc stop backup`, `sudo cryptdisks_start kita-backup`, `sudo mount /mnt/backup`, dann `dc up -d` |
| „No off-site drive“ | Eine einstecken (siehe unten), `sudo mount /mnt/offsite && dc restart backup` |
| „photo share is not mounted“ | Prüfen, ob das NAS an ist; `dc stop api backup`, `sudo mount /mnt/photos`, dann `dc up -d` |
| „No nightly backup“ | `dc logs --tail 50 backup`; meist eine Platte (oben); eine von Hand starten: `dc exec backup run-job nightly` |
| „UPS …“ | Siehe die Zeile zur USV unten |
| „Updates are waiting for a restart“ | Siehe Updates unten |

Andere Warnungen:

| Betreff | Tun |
|---|---|
| „Kita crash: BackupFailed in nightly backup“ (oder weekly backup, backup service) | Wie „No nightly backup“ oben; „backup service“ heißt, eine Platte fehlt |
| „Kita crash: …“ (alles andere) | An den Entwickler weiterleiten |
| „Kita server UPS: … on battery“ | Stromausfall: nichts zu tun; dauert er lange, fährt der Server selbst herunter |
| Fehler bei automatischem Update | An die IT weiterleiten |

## Jede Woche: die Platte für außer Haus tauschen

Am vereinbarten Tag (nach der Sicherung am Sonntag):

```
dc stop backup && sudo umount /mnt/offsite
```
Platte abziehen, mit nach Hause (oder in den Tresor) nehmen; die andere einstecken, dann:
```
sudo mount /mnt/offsite && dc start backup
```

Vergessen, sie wieder zu starten, oder keine Platte eingesteckt? Die Prüfung am nächsten Morgen schickt eine Warnung; ein ohne Platte gestarteter Sicherungsdienst schickt sofort eine, und dann jede Stunde wieder.

## Updates

- Ubuntu aktualisiert sich selbst. Zeigt `ls /var/run/reboot-required` die Datei: zu einer ruhigen Zeit neu starten (`sudo reboot`) und die Festplatten-Passphrase eingeben.
- Neue Version der App: `cd /opt/kita && git pull && dc up -d --build --wait`.

## Mitarbeiter:innen

- Neue Kollegin: in der App, Mitarbeiterkonten → anlegen (macht ein:e Admin).
- Jemand geht: das Konto noch am selben Tag deaktivieren.

## Wiederherstellen (Daten verloren oder neuer Server)

Nur mit Entwickler oder IT am Telefon. Die Schritte stehen in der README unter „Restore“. Gebraucht wird der App-Schlüssel; von einer Platte außer Haus zusätzlich der private Sicherungsschlüssel.

## Niemals

- Ports am Router weiterleiten oder die Adresse des Servers ins Internet stellen.
- Die Schlüssel auf dem Server, einem Tablet oder in einer E-Mail aufbewahren.
- Den Server ohne Herunterfahren (`sudo shutdown -h now`) ausstecken, außer die USV tut es.
