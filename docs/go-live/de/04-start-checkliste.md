# Start-Checkliste

Jede Zeile der Reihe nach abhaken. Die Zeilen zum Server erledigt der Entwickler oder die IT (Befehle aus `docs/server`; `dc` = `docker compose -f /opt/kita/compose.prod.yaml`).

## Vor dem Tag

| | Wer | ✓ |
|---|---|:-:|
| Der Abnahmetest ist abgenommen (`docs/acceptance/04`); jedes „vor dem Start beheben“ ist behoben und erneut getestet | Kita-Leitung | ☐ |
| Die Version für den Start hat einen Tag (siehe `05`) und ihr CI-Lauf ist grün, mit dem Wiederherstellungstest | Entwickler | ☐ |
| Schulung gehalten (`03`), noch mit den erfundenen Daten; Karten gedruckt und neben den Tablets (`02`); Handbuch (`01`) im Büro | Admin | ☐ |
| Die erfundenen Testdaten sind vom Server entfernt (`docs/acceptance/01`, „Danach“) | IT | ☐ |
| Die Version ist installiert, wie in `05` Schritt 4 | IT | ☐ |
| Die erste Admin (die Kita-Leitung) ist neu angelegt; alle Mitarbeiterkonten sind eingeladen | IT, Admin | ☐ |
| Eine erste Sicherung gemacht (`dc exec backup run-job nightly`), dann die Prüfung gestartet (`sudo systemctl start kita-health-check.service`); `journalctl -u kita-health-check --no-pager \| tail` meldet „all well“ | IT | ☐ |
| Die Schlüssel sind gedruckt und im Tresor: Festplatten-Passphrase, Passphrase der Sicherungsplatte, App-Schlüssel, privater Sicherungsschlüssel | Kita-Leitung | ☐ |
| Jedes Tablet: Zertifikat installiert, die App auf dem Startbildschirm, die Sprache gewählt | Admin | ☐ |

## Die echten Daten eintragen

| | Wer | ✓ |
|---|---|:-:|
| Gruppen, und die Mitarbeiter:innen in ihren Gruppen | Admin | ☐ |
| Jedes Kind: Profil, Gruppe, Allergien und Erkrankungen, Eltern, Notfallkontakte, abholberechtigte Personen, Einwilligungen | Admins (zwei Personen prüfen gegenseitig Allergien und abholberechtigte Personen gegen die Papierakten) | ☐ |
| Feiertage und Ferien für das Schuljahr übernommen | Admin | ☐ |

## Die Sicherungen prüfen (die erste Nacht nach den echten Daten)

| | Wer | ✓ |
|---|---|:-:|
| `dc logs --tail 20 backup` zeigt „Nightly backup … done.“ | IT | ☐ |
| Die neueste Sicherung lässt sich öffnen: der Befehl unten listet die Tabellen | IT | ☐ |
| Einmal eine Wiederherstellung auf einem Ersatzrechner ausprobiert (nie auf dem laufenden Server): die Schritte unter „Restore“ in der README, eine Kopie der neuesten Sicherung der Sicherungsplatte und der App-Schlüssel; ein Kinderprofil ist mit seinem Foto zurück | IT | ☐ |
| Nach dem ersten Sonntag: eine wöchentliche Sicherung auf der Platte für außer Haus (`ls /mnt/offsite`); die Platte getauscht, wie im Betriebshandbuch | IT, Admin | ☐ |
| Eine fehlgeschlagene Sicherung erreicht jemanden: `dc exec backup report-failure nightly` schickt „Kita crash: BackupFailed in nightly backup“ an `KITA_CRASH_REPORT_EMAIL` | IT | ☐ |

```
dc exec backup sh -c 'pg_restore --list "$(ls -1 /backups/db/kita-*.dump | tail -n 1)" | head'
```

## Papier als Rückfall

| | Wer | ✓ |
|---|---|:-:|
| Jeden Morgen, wenn die Kinder angekommen sind, wird die Notfallliste der ganzen Kita gedruckt und an der Tür aufbewahrt (für einen Ausfall von Strom oder Netz) | Mitarbeiter:innen, täglich | ☐ |
| Die Papierakten bleiben, bis die Kita-Leitung entscheidet, dass man der App vertraut (Vorschlag: 4 Wochen) | Kita-Leitung | ☐ |

## Der Starttag

| | Wer | ✓ |
|---|---|:-:|
| Alle Mitarbeiter:innen melden sich einmal an und lassen die Kinder ihrer Gruppe ankommen | Alle | ☐ |
| Die erste Notfallliste gedruckt und mit den anwesenden Kindern verglichen | Admin | ☐ |
| Nach 1 Woche: ein kurzes Gespräch, was schwierig ist; Befunde als Feedback oder an den Entwickler | Kita-Leitung | ☐ |

Live seit: ____________  Kita-Leitung: ______________________  Unterschrift: ______________________
