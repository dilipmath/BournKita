# Datenschutz-Folgenabschätzung (Art. 35 DSGVO)

## Teil A: Ist sie nötig?

Eine Folgenabschätzung ist nötig, wenn eine Verarbeitung voraussichtlich ein hohes Risiko birgt. Die Leitlinien der europäischen Datenschutzbehörden (WP248, vom EDSA bestätigt) nennen neun Kriterien; sind **zwei oder mehr** erfüllt, ist sie in der Regel nötig. Zusätzlich die Liste der Aufsichtsbehörde des Bundeslandes der Kita prüfen.

| Nr. | Kriterium | Hier | Erfüllt? |
|---|---|---|:-:|
| 1 | Bewertung oder Einstufung (Profiling) | Keine Bewertung von Kindern oder Mitarbeiter:innen | nein |
| 2 | Automatisierte Entscheidungen mit rechtlicher oder ähnlicher Wirkung | Keine | nein |
| 3 | Systematische Überwachung | Ankommen und Abholen werden je Tag festgehalten, aber für Betreuung und Sicherheit, nicht zur Überwachung | ☐ |
| 4 | Sensible oder höchstpersönliche Daten | Gesundheitsdaten (Allergien und Erkrankungen, Krankheitstage); Essensvorlieben können Gesundheit oder Religion verraten, Sprachen die ethnische Herkunft | **ja** |
| 5 | Umfangreiche Verarbeitung | Eine Kita (etwa ___ Kinder) | nein |
| 6 | Abgleich oder Zusammenführen von Datensätzen | Nein | nein |
| 7 | Schutzbedürftige Betroffene | Kinder | **ja** |
| 8 | Neue Technologien | Eine herkömmliche Web-App; keine KI in Release 1 | nein |
| 9 | Hindert an der Ausübung eines Rechts oder Nutzung einer Leistung | Nein | nein |

**Ergebnis:** Mindestens zwei Kriterien (4 und 7) sind erfüllt; eine förmliche Folgenabschätzung wird daher **empfohlen**. Entscheidung in 04.

## Teil B: Entwurf der Folgenabschätzung

### 1. Beschreibung

Siehe Konzept (01): was gespeichert wird (Abschnitt 2), warum (3), wer es sieht (4), wie lange (6). Release 1 der Kita Kids Database auf dem eigenen Server der Kita, genutzt von etwa ___ Mitarbeiter:innen auf ___ Tablets und ___ PCs.

### 2. Notwendigkeit und Verhältnismäßigkeit

- **Zweckbindung:** Jede Art von Daten dient der Betreuung oder Sicherheit der Kinder (01, Abschnitt 3).
- **Datenminimierung:** Nur, was die Kita schon heute auf Papier festhält; Gäste sehen keine personenbezogenen Daten; Exporte nennen andere Eltern nur mit Namen und Mitarbeiter:innen nur mit Rolle.
- **Speicherbegrenzung:** Gelöschte Profile werden nach der Frist endgültig gelöscht; offene Fristen in 04.
- **Rechte:** Auskunft, Löschung, Berichtigung und Widerruf sind eingebaut (01, Abschnitt 7).

### 3. Risiken und Maßnahmen

Eintrittswahrscheinlichkeit und Schwere: gering, mittel, hoch (nach den Maßnahmen).

| Risiko | Vorhandene Maßnahmen | Wahrscheinlichkeit | Schwere |
|---|---|:-:|:-:|
| Jemand außerhalb der Kita liest die Daten (Angriff aus dem Internet) | Nur im Kita-Netz, keine Portweiterleitung, HTTPS, Anmeldung mit Sperre | gering | hoch |
| Ein verlorenes oder gestohlenes Tablet wird zum Lesen genutzt | Sitzung endet nach 30 Minuten ohne Aktivität; Tablets brauchen eine eigene Bildschirmsperre (☐ prüfen) | mittel | hoch |
| Server oder Sicherungsfestplatte wird gestohlen | Festplattenverschlüsselung (H4), Feldverschlüsselung, Fotos verschlüsselt, Sicherungen außer Haus verschlüsselt, Schlüssel getrennt | gering | hoch |
| Ein:e Mitarbeiter:in sieht Daten an, die sie oder er nicht braucht | Rollen; jedes Ansehen im Protokoll; Admins sehen es durch | mittel | mittel |
| Falsche Person holt ein Kind ab | Abholberechtigte mit Fotos im Profil | gering | hoch |
| Allergie im Notfall nicht bekannt | Allergien und Erkrankungen im Profil, in der Gruppe, in „Heute“ und auf der Notfallliste | gering | hoch |
| Fotos ohne Einwilligung gezeigt | Nur sichtbar, solange die Foto-Einwilligung besteht; Widerruf blendet sie sofort aus | gering | mittel |
| Daten länger aufbewahrt als nötig | Archiv mit automatischer Löschung; Löschung auf Anfrage; offene Fristen in 04 | mittel | mittel |
| Datenverlust (defekte Festplatte, Brand) | Nächtliche und wöchentliche Sicherung, Kopie außer Haus; die Wiederherstellung wird bei jeder Änderung der App getestet (mit Testdaten), und die Kita probiert ab und zu ihre eigene | gering | hoch |
| Daten verlassen die Kita per E-Mail | Nur E-Mail-Adressen der Mitarbeiter:innen, Erinnerungen (Titel und Notiz eines Termins), Feedback (mit Seite und Absender) und Absturzberichte; das Feedback-Formular bittet, keine Namen oder Gesundheitsangaben zu schreiben; Auftragsverarbeitungsvertrag mit dem Mailanbieter | mittel | mittel |
| Daten im Log des Servers sichtbar | Ein Mailserver ist eingerichtet, damit keine E-Mails ins Log geschrieben werden; das Log liegt auf dem verschlüsselten Server, für eine festgelegte Zeit (04) | gering | mittel |
| Gedruckte Notfalllisten liegen herum | An einem festen Ort aufbewahrt und nach Gebrauch vernichtet (04) | mittel | mittel |
| Ein Gast sieht ein Kind, das in einem Termin der ganzen Kita genannt wird | Mitarbeiter:innen nennen in Terminen keine Kinder | gering | gering |

### 4. Restrisiko

Mit den Maßnahmen und den geklärten offenen Punkten des Konzepts (01, Abschnitt 9) wird das Restrisiko eingeschätzt als: ☐ vertretbar ☐ nicht vertretbar (dann Aufsichtsbehörde konsultieren, Art. 36).

### 5. Freigabe

Datenschutzbeauftragte:r: ______________________  Datum: ____________

Kita-Leitung: ______________________  Datum: ____________
