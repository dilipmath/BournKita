# Datenschutzkonzept: Kita Kids Database

Kita: ______________________  Träger: ______________________  Stand: Entwurf zu Release 1  Datum: ____________

## 1. Zweck

Die Kita Kids Database hilft den Mitarbeiter:innen der Kita, die Profile der Kinder, ihre Sicherheitsdaten (Allergien und Erkrankungen, wer abholen darf, wen man anrufen kann), die Gruppen und die tägliche Arbeit (Anwesenheit, Aufgaben, Kalender, Vorfälle) an einem Ort zu führen, statt in Ordnern und Tabellen. Sie dient der Betreuung der Kinder und ihrer Sicherheit, vor allem im Notfall.

## 2. Wessen Daten, und welche

| Wer | Daten | Verschlüsselt gespeichert |
|---|---|---|
| **Kinder** | Vor- und Nachname, Geschlecht, Sprachen, Essensvorlieben, Interessen, Geburtsdatum, Gruppe | nein |
| | Allergien und Erkrankungen: was es ist, was zu tun ist | **ja** |
| | Fotos (Galerie), nur mit Foto-Einwilligung sichtbar | **ja** (Dateien) |
| | Einwilligungen (Fotos, Ausflüge, Datenschutz): erteilt am, widerrufen am | nein |
| | Anwesenheit: Ankommen und Abholen (Uhrzeiten, je Tag) | nein |
| | Abwesenheiten: von, bis | nein |
| | Grund einer Abwesenheit (krank, Urlaub, anderes) | **ja** |
| | Vorfälle: Tag, Uhrzeit, wer ihn gemeldet hat | nein |
| | Vorfälle: was passiert ist, wer informiert wurde; Nachträge (und wer sie schrieb) | **ja** (Texte) |
| **Eltern** | Vor- und Nachname; darf das Kind abholen: ja oder nein | nein |
| | Adresse, Telefon, E-Mail | **ja** |
| | Foto (als Abholberechtigte; ohne Einwilligung erfragt) | **ja** (Datei) |
| **Notfallkontakte und Abholberechtigte** | Name, Beziehung (z. B. Großmutter) | nein |
| | Telefon, Notiz | **ja** |
| | Foto (Abholberechtigte; ohne Einwilligung erfragt) | **ja** (Datei) |
| **Mitarbeiter:innen** | E-Mail-Adresse, Rolle, die Gruppen, in denen sie arbeiten, Kontostatus | nein |
| | Passwort (nur als Argon2-Hash; nie lesbar) | gehasht |
| | Sitzungen (letzte Aktivität) und Fehlversuche bei der Anmeldung (für die Sperre) | nein |
| | Was sie angesehen oder geändert haben: das Protokoll, mit ihrer E-Mail-Adresse | nein |
| | Gesendetes Feedback: der Text | **ja** |
| | Gesendetes Feedback: ihre E-Mail-Adresse, die Seite, von der es kam | nein |
| | Ihnen zugewiesene Aufgaben | nein |
| **Alle, die in freiem Text genannt werden** | Titel und Notizen von Aufgaben und Terminen, frei geschrieben (können ein Kind nennen) | nein |

Verschlüsselt wird mit AES-256-GCM und einem Schlüssel, der getrennt von der Datenbank aufbewahrt wird (`KITA_ENCRYPTION_KEY`); jeder Wert ist an seinen Datensatz gebunden, kopiert ist er unlesbar. Zusätzlich wird die Festplatte des Servers verschlüsselt (H4).

**Auf Papier:** Die Notfallliste (PDF) zeigt die anwesenden Kinder, ihre Allergien und Erkrankungen und wen man anrufen kann, mit Telefonnummern. Gedruckt verlässt sie den Schutz der App (siehe 9).

**Besondere Kategorien (Art. 9 DSGVO):** Allergien und Erkrankungen und der Abwesenheitsgrund „krank“ sind Gesundheitsdaten. Essensvorlieben können Gesundheit (z. B. laktosefrei) oder Religion (z. B. „halal“) verraten, Sprachen die ethnische Herkunft; beide sind unverschlüsselt (siehe 9).

## 3. Warum (Rechtsgrundlage, vom Datenschutzbeauftragten zu bestätigen)

Welches Recht gilt, hängt vom Träger ab: Für einen kommunalen Träger gilt das Landesdatenschutzgesetz, für einen kirchlichen das Kirchenrecht (KDG für katholische, DSG-EKD für evangelische Träger), für einen freien oder privaten die DSGVO und das BDSG; für alle gilt der Sozialdatenschutz des SGB VIII (§§ 61–65) für die Kinder- und Jugendhilfe. Siehe 04, Abschnitt 1. Die Grundlagen unten sind nur Vorschläge.

| Daten | Zweck | Mögliche Grundlage |
|---|---|---|
| Kinderprofile, Eltern, Gruppen, Anwesenheit, Abwesenheiten | Betreuung nach Betreuungsvertrag und Landes-Kitagesetz | Art. 6 Abs. 1 lit. b und c, Landes-Kitagesetz, SGB VIII |
| Allergien und Erkrankungen | Schutz der Gesundheit des Kindes | ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a) oder eine landesrechtliche Grundlage; im Notfall Art. 9 Abs. 2 lit. c |
| Notfallkontakte, Abholberechtigte, ihre Fotos | Jemanden erreichen; das Kind nur Berechtigten übergeben | Art. 6 Abs. 1 lit. b; Fotos von Erwachsenen: deren Einwilligung |
| Fotos der Kinder | Galerie für Eltern und Kita | Art. 6 Abs. 1 lit. a: Einwilligung, jederzeit widerrufbar |
| Vorfälle und Nachträge | Pflicht, Unfälle zu dokumentieren (z. B. für die Unfallkasse) | Art. 6 Abs. 1 lit. c |
| Protokoll | Nachweis, wer auf welche Daten zugegriffen hat | Art. 5 Abs. 2, Art. 32 |
| Mitarbeiterkonten | Anmeldung, Rollen | Arbeitsrecht; § 26 BDSG ist seit dem EuGH-Urteil C-34/21 zweifelhaft |

## 4. Wer sieht was

| Rolle | Sieht und tut |
|---|---|
| **Admin** (Kita-Leitung, Stellvertretung) | Alles; ändert Kinderprofile und Eltern; verwaltet Mitarbeiterkonten, Archiv, Protokoll, Feedback, Datenexporte und Löschungen; schreibt Nachträge zu Vorfällen |
| **Erzieher:in** | Liest die vollständigen Profile aller Kinder: Allergien und Erkrankungen, Eltern mit Adresse, Telefon und E-Mail, Kontakte, Fotos, Einwilligungen. Trägt Anwesenheit und Abwesenheiten ein; legt Termine und Aufgaben an und ändert sie; meldet Vorfälle und sieht die selbst gemeldeten; druckt die Notfallliste |
| **Gast** | Nur die Termine der ganzen Kita sowie Feiertage und Ferien. Die App gibt einem Gast keine personenbezogenen Daten aus ihren Datensätzen; aber Titel und Notizen von Terminen werden frei geschrieben, also sieht ein Gast, was in einem Termin der ganzen Kita steht |
| **Niemand außerhalb der Kita** | Die App läuft auf dem eigenen Server der Kita, nur im Kita-Netz erreichbar, über HTTPS. Keine Cloud, kein Port zum Internet geöffnet. |

Was die App verlässt:
- **E-Mails, über den Mailanbieter der Kita** (Auftragsverarbeiter; Vertrag nach Art. 28 nötig):
  - an Mitarbeiter:innen: Einladungen und Passwort-Zurücksetzen (mit einem Link zum Festlegen des Passworts), Erinnerungen (Titel, Notiz, Tag und Gruppe eines Termins);
  - an den Entwickler, oder an die Adresse für Absturzberichte, wenn keine Feedback-Adresse eingestellt ist: Feedback (Art, Text wie eingegeben, Seite, E-Mail-Adresse des Absenders) und Absturzberichte;
  - Absturzberichte enthalten keine Namen, Texte oder Adressen, nur wo im Programm etwas fehlschlug; fehlgeschlagene Sicherungen werden ebenso gemeldet.
- **Ist kein Mailserver eingerichtet**, schreibt die App jede E-Mail, Links und Feedback-Text eingeschlossen, stattdessen in das Protokoll des Servers (Log). Dieses Log braucht dann denselben Schutz (siehe 9).
- **Der Entwickler**, wenn er nicht zur Kita gehört: braucht einen Auftragsverarbeitungsvertrag oder eine Verschwiegenheitserklärung, weil Feedback enthalten kann, was eingegeben wurde.
- **Eltern auf Anfrage:** ein Export ihrer eigenen Daten und der ihrer Kinder (Auskunft, Art. 15). Andere Eltern erscheinen darin nur mit Namen, Mitarbeiter:innen nur mit ihrer Rolle.
- **Auf Papier:** gedruckte Notfalllisten (siehe 2).

## 5. Schutz (technische und organisatorische Maßnahmen)

- Nur im Kita-Netz; HTTPS mit eigener Zertifizierungsstelle der Kita; keine Portweiterleitung.
- Anmeldung: E-Mail und Passwort (mindestens 12 Zeichen, mit Argon2 gehasht); nach 5 Fehlversuchen in Folge 15 Minuten gesperrt; Sitzungen enden nach 30 Minuten ohne Aktivität; Cookies mit Secure, HttpOnly und SameSite=Strict.
- Rollen (Admin, Erzieher:in, Gast), bei jeder Anfrage geprüft; Gäste werden überall abgewiesen, außer auf Seiten, die für sie gedacht sind.
- Feldverschlüsselung (siehe 2), Fotos verschlüsselt gespeichert, Festplattenverschlüsselung des Servers (H4).
- Protokoll jedes Ansehens eines Kinderprofils und jeder Änderung von Daten eines Kindes, mit den Feldern, nie den Werten. Namenslisten und Suchen werden nicht protokolliert.
- Fotos nur sichtbar, solange die Foto-Einwilligung besteht; ein Widerruf blendet sie sofort aus (die Dateien bleiben, siehe 9).
- Absturzberichte ohne personenbezogene Daten.
- Datensicherung: nächtlich auf eine zweite Festplatte (nur für root lesbar; Festplatte zu verschlüsseln), wöchentlich mit age verschlüsselt für außer Haus, privater Schlüssel getrennt. Ein Test in der Entwicklung stellt bei jeder Änderung der App beide Arten in eine frische Datenbank wieder her; die Kita sollte zusätzlich ab und zu eine eigene Sicherung probeweise wiederherstellen.
- Organisatorisch: Admin-Konten nur für die, die sie brauchen; Konten beim Ausscheiden deaktivieren; Verschlüsselungs- und Sicherungsschlüssel gedruckt und verschlossen; Bildschirmsperre auf jedem Tablet; Schulung des Teams (H7).

## 6. Wie lange

| Daten | Aufbewahrt bis | Entscheidung |
|---|---|---|
| Profil eines Kindes mit allen Daten | Von Admin gelöscht → **12 Monate** im Archiv (Platzhalter) → endgültig gelöscht, mit Fotos und den Eltern, die kein Kind mehr haben | ☐ siehe 04 |
| Anwesenheit und Abwesenheiten eines Kindes, das noch da ist | Solange das Kind in der Kita ist (ohne Grenze) | ☐ siehe 04 |
| Vorfälle | Mit dem Kind (Archiv, dann gelöscht) | ☐ Aufbewahrungspflicht der Unfallkasse prüfen |
| Fotos nach Widerruf der Foto-Einwilligung | Sofort ausgeblendet, aber aufbewahrt, bis das Kind endgültig gelöscht wird | ☐ siehe 04 |
| Daten eines Elternteils bei einer Löschung auf Anfrage | Sofort endgültig gelöscht: das Elternteil, **alle** seine Kinder (auch archivierte, mit Vorfällen) und die anderen Eltern der Kinder, die kein Kind mehr haben | ☐ siehe 04 |
| Aufgaben und Termine (Titel und Notizen) | Ohne Grenze; nicht mit einem Kind gelöscht | ☐ siehe 04 |
| Protokoll | Ohne Grenze; Einträge behalten die E-Mail-Adresse der Mitarbeiter:in und, sobald die Daten weg sind, die Nummer des Kindes oder Elternteils | ☐ siehe 04 |
| Feedback | Ohne Grenze | ☐ siehe 04 |
| Mitarbeiterkonten | Deaktiviert, nie gelöscht (damit das Protokoll sie nennen kann) | ☐ siehe 04 |
| Server-Logs | Die Log-Dateien von Docker auf dem Server, ohne festgelegte Grenze | ☐ siehe 04 |
| Sitzungen, Links in E-Mails | Sitzungen enden nach 30 Minuten ohne Aktivität; Links gelten 7 Tage (Einladung) oder 1 Stunde (Passwort) | — |
| Datensicherungen | Die letzten 14 nächtlichen (etwa zwei Wochen) und die letzten 8 wöchentlichen (etwa zwei Monate); gelöschte Daten bleiben so lange darin | ☐ siehe 04 |

## 7. Rechte der Betroffenen

- **Auskunft (Art. 15):** Ein:e Admin exportiert auf der Seite eines Elternteils alles über dieses und seine Kinder (ZIP mit allen Daten und Fotos).
- **Löschung (Art. 17) auf Anfrage:** Ein:e Admin löscht auf der Seite eines Elternteils dessen Daten sofort endgültig, mit **allen** seinen Kindern (siehe 6); im Protokoll vermerkt, ohne die Daten.
- **Berichtigung (Art. 16):** Admins korrigieren Profile jederzeit.
- **Widerruf einer Einwilligung:** mit Datum festgehalten; Fotos werden sofort ausgeblendet (aber aufbewahrt, siehe 9).

## 8. Datenpannen

Ein Verdacht (verlorenes Gerät, falsche Person hatte Zugriff) geht sofort an die Kita-Leitung und den Datenschutzbeauftragten. Eine meldepflichtige Panne muss binnen 72 Stunden bei der Aufsichtsbehörde sein (Art. 33); bringt sie die Betroffenen voraussichtlich in hohe Gefahr, sind auch sie zu benachrichtigen (Art. 34). Das Protokoll zeigt, wer welches Kinderprofil angesehen hat.

## 9. Offene Punkte

1. Essensvorlieben und Sprachen sind unverschlüsselt, können aber Gesundheit, Religion oder ethnische Herkunft verraten. ☐
2. Namen von Notfallkontakten und Abholberechtigten sind unverschlüsselt. ☐
3. Erzieher:innen sehen die vollständigen Profile aller Kinder, auch die Adressen der Eltern, nicht nur die ihrer Gruppen. ☐
4. Fotos bleiben nach Widerruf der Foto-Einwilligung gespeichert (Art. 17 Abs. 1 lit. b kann ihre Löschung verlangen). ☐
5. Eine Löschung auf Anfrage eines Elternteils löscht alle seine Kinder, samt der Verbindung zum anderen Elternteil und den Vorfällen. ☐
6. Aufgaben und Termine haben keine Aufbewahrungsgrenze, und ihr freier Text kann Kinder nennen. ☐
7. Gedruckte Notfalllisten: wo sie liegen und wie sie vernichtet werden. ☐
8. Server-Logs: wie lange sie aufbewahrt werden, und dass sie ohne Mailserver die E-Mails enthalten. ☐
9. Die mit ☐ markierten Fristen in 6. ☐
10. Auftragsverarbeitungsverträge mit dem Mailanbieter und, falls extern, dem Entwickler. ☐
11. Bildschirmsperre auf jedem Tablet. ☐
