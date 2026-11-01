# Testplan

## Ziel

Zeigen, dass Release 1 tut, was die Kita braucht: auf dem eigenen Server und den eigenen Tablets der Kita, benutzt von den Menschen, die es jeden Tag benutzen werden. Der Test ist bestanden, wenn die Kita-Leitung ihn abnimmt (`04`).

## Wer

| Wer | Aufgabe im Test | In der App |
|---|---|---|
| Die Kita-Leitung | Entscheidet; nimmt ab | Admin |
| 1 oder 2 weitere Admins (z. B. die Stellvertretung) | Legen die erfundenen Daten an; Admin-Fälle | Admin |
| 2 bis 4 Erzieher:innen, mindestens eine, die unsicher mit Computern ist | Alltagsfälle | Erzieher:in |
| Eine von ihnen, für einen Fall | Die Gastansicht | Gast |
| Der Entwickler (oder die IT) | Betreut den Server, beantwortet Fragen, schreibt die Befunde auf | — |

## Wann und wo

- Ein halber Tag (etwa 4 Stunden) an einem normalen Arbeitstag, zu einer ruhigen Zeit: Teil A (Einrichten) etwa 1 Stunde, Teil B (Alltag) etwa 2 Stunden, Bewerten und Abnahme etwa 1 Stunde.
- In der Kita, im WLAN der Kita, mit den Tablets, die das Team benutzen wird, und dem Drucker im Büro.
- Teil C (Sicherungen und E-Mails am nächsten Morgen) prüft der Entwickler oder die IT am Tag darauf.

## Vorher erledigt

| | Erledigt? |
|---|:-:|
| H1: der Umfang von Release 1 abgenommen, seine Muss- und Soll-Änderungen umgesetzt | ☐ |
| H3: die in den Ergebnissen des Usability-Tests mit „vor dem Start“ markierten Änderungen umgesetzt | ☐ |
| H4: der Server eingerichtet und seine Checkliste abgehakt (`docs/server`), auf dem die zu testende Version läuft | ☐ |
| H5: die offenen Punkte der Sicherheitsprüfung bekannt (S1, S2, S5 auf GitHub); keiner davon verhindert den Test | ☐ |
| Das erste Admin-Konto gibt es (das der Kita-Leitung) | ☐ |
| Die Tablets vertrauen dem Zertifikat des Servers und öffnen `https://kita.home.arpa` | ☐ |
| Alle Testenden können am Tag ihre eigenen E-Mails lesen (für die Einladung) | ☐ |
| `02` gedruckt, eines je Paar von Testenden; `03` einmal gedruckt | ☐ |
| Die Feiertage und die Schulferien der Region als zwei .ics-Dateien heruntergeladen, für Fall A15 | ☐ |
| Ein paar Fotos zum Hochladen auf einem Tablet (keine echten Kinder: z. B. Spielzeug, der Garten) | ☐ |

## Die Daten

**Nur erfundene.** Die Testfälle bringen ihre eigenen Kinder, Eltern und Gruppen mit (Lena Weber, die Monkeys, …). Nie ein echtes Kind, einen echten Elternteil oder echte Gesundheitsangaben eintragen: Der Server wird danach geleert, aber die Sicherungen behalten das Eingetragene bis zu 8 Wochen.

Die eigenen Mitarbeiterkonten der Testenden nutzen ihre echten E-Mail-Adressen (die Einladung muss sie erreichen); sie werden danach mit dem Rest entfernt.

## Ergebnisse

Jeder Fall wird mit ✓, ✗ oder ~ abgehakt, wie die Testfälle (`02`) erklären. Jedes ✗ und ~ wird eine Zeile in der Befundliste (`03`), in den Worten der Testenden.

## Befunde bewerten

Am Ende bekommt jeder Befund gemeinsam eine Bewertung:

| Bewertung | Heißt | Für den Start |
|---|---|---|
| **Blocker** | Falsche oder verlorene Daten, ein Sicherheitsrisiko (z. B. eine falsche Allergie oder Erkrankung, eine falsche abholberechtigte Person), Daten für jemanden sichtbar, der sie nicht sehen darf, oder ein Muss-Fall, der nicht geht | Vor dem Start beheben und erneut testen |
| **Major** | Ein Fall geht nur mit Hilfe oder auf Umwegen, oder das Team würde die App deshalb meiden | Vor dem Start beheben, außer die Kita-Leitung akzeptiert ihn in `04` mit einem Datum |
| **Minor** | Funktioniert, ist aber umständlich, unklar oder unschön | Nach dem Start |
| **Idee** | Etwas Neues, nicht Teil von Release 1 | Für Release 2 gesammelt |

## Bestanden, wenn

- jeder Fall in Teil A und B durchgeführt wurde,
- kein Blocker offen ist,
- jeder Major behoben oder von der Kita-Leitung schriftlich, mit Datum, akzeptiert ist,
- und die Kita-Leitung `04` unterschreibt.

Eine Behebung wird vor dem Start mit dem Fall erneut getestet, der sie gefunden hat (nur mit diesem, außer sie berührt andere).

## Nicht im Test geprüft

Das endgültige Löschen nach der Aufbewahrungsfrist (12 Monate), Absturzberichte und das Wiederherstellen einer Sicherung lassen sich nicht an einem Nachmittag ausprobieren. Automatische Tests prüfen sie bei jeder Änderung; das Wiederherstellen wird beim Start auch auf dem Server der Kita ausprobiert (H7).

## Danach: den Server leeren

Erst nach Teil C und der Abnahme: Die erfundenen Daten dürfen nicht live gehen. Mit dem Entwickler oder der IT, auf dem Server (die Befehle aus `docs/server`):

```
cd /opt/kita && dc down
docker volume rm kita_db-data kita_photos     # die Testdaten und -fotos; kita_caddy-data behalten (das Zertifikat der Tablets)
sudo rm -rf /mnt/backup/kita/db /mnt/backup/kita/photos     # die nächtlichen Sicherungen der Testdaten
sudo rm -f /mnt/offsite/kita-*.tar.age                         # die wöchentlichen
```

Die letzte Zeile auch auf der anderen Platte für außer Haus, falls sie seit dem Test eingesteckt war. Liegen die Fotos auf einem Netzlaufwerk (`KITA_PHOTO_DIR`), auch diesen Ordner leeren. Dann `dc up -d --wait` und das erste Admin-Konto neu anlegen (README, „Run in production“): Der Server ist bereit für den Start (H7).
