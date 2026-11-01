# Support und Updates

Wie Probleme zum Entwickler kommen, wie schnell sie beantwortet werden, und wie eine neue Version in die Kita kommt.

## Wen fragen

| Problem | Zuerst | Dann |
|---|---|---|
| Wie mache ich …? | Das Handbuch, die Karten, eine Admin | — |
| Etwas in der App stimmt nicht oder ist schwierig; eine Idee | **„Feedback“** in der App (geht mit der Seite an den Entwickler) | — |
| Die App öffnet sich gar nicht | Das Betriebshandbuch: „Nach einem Stromausfall oder Neustart“ | IT: ____________ |
| Eine Warn-E-Mail vom Server | Das Betriebshandbuch: „Eine Warn-E-Mail ist gekommen“ | IT: ____________ |
| Eine Absturz-E-Mail („Kita crash: …“) | Nichts: Sie ging auch an den Entwickler | — |
| Daten sehen falsch aus, oder jemand hat gesehen, was er nicht darf | Sofort die Kita-Leitung; das Protokoll zeigt, wer was getan hat | Entwickler: ____________ |

## Wie schnell

| Art | Beispiel | Antwort | Behebung |
|---|---|---|---|
| **Dringend** | Die App ist ausgefallen; falsche Sicherheitsdaten (Allergien, abholberechtigte Personen); ein Datenleck | Am selben Arbeitstag, telefonisch | So bald wie möglich; eine Notlösung am selben Tag (Papier als Rückfall) |
| **Normal** | Ein Fehler mit Umweg | Innerhalb von 3 Arbeitstagen | Im nächsten Release |
| **Wunsch** | Ein Änderungswunsch, eine Idee | Innerhalb von 2 Wochen | Mit der Kita-Leitung geplant (Liste für Release 2) |

Kontakt: Entwickler ____________ (Telefon, E-Mail); erreichbar ____________.

## Was mit Feedback geschieht

Der Entwickler liest jedes Feedback, hält es als Issue auf GitHub fest (ohne Namen von Kindern) und antwortet der Person, die es geschickt hat. Etwa jeden Monat gehen der Entwickler und die Kita-Leitung die offenen Issues durch und entscheiden, was als Nächstes kommt.

## Releases

Ein Release ist eine neue Version der App, getestet und zu einer festen Zeit installiert. `dc` unten ist die Abkürzung für `docker compose -f /opt/kita/compose.prod.yaml` (wie im Betriebshandbuch).

1. **Gebaut und getestet** vom Entwickler: Jede Änderung durchläuft die automatischen Tests (CI), mit dem Test der Wiederherstellung einer Sicherung. Ein Release gibt es nur, wenn alle bestehen.
2. **Benannt:** Die Version in `backend/pyproject.toml` und `frontend/package.json` steigt (z. B. 1.0.0 → 1.1.0; 1.0.1 nur für Behebungen), und der Commit bekommt auf GitHub einen Tag (`v1.1.0`) mit einer kurzen Liste der Änderungen, auf Englisch und Deutsch, für die Kita; sie sagt, ob es die Datenbank ändert.
3. **Abgesprochen:** Die Kita-Leitung bekommt die Liste und vereinbart eine ruhige Zeit (nicht beim Bringen oder Abholen).
4. **Installiert** von der IT oder dem Entwickler, zu dieser Zeit:

   ```
   dc exec backup run-job nightly                 # zuerst eine frische Sicherung
   cd /opt/kita && git fetch --tags && git checkout v1.1.0
   dc up -d --build --wait                        # die App ist etwa eine Minute weg
   ```

   Dann die App auf einem Tablet öffnen und ein Kinderprofil und die Notfallliste ansehen.
5. **Schiefgegangen?** Zurück zum vorigen Tag: `git checkout v1.0.0 && dc up -d --build --wait`. Steht in der Liste der Änderungen, dass die neue Version die Datenbank geändert hat, reicht das nicht: mit dem Entwickler am Telefon den vorigen Tag auschecken, `dc build` ausführen, dann den Schritten unter „Restore“ in der README folgen, mit der Sicherung aus Schritt 4 (`restore <ihr Datum>`, nicht `latest`, falls seitdem eine nächtliche Sicherung lief).
6. **Mitgeteilt:** Die Mitarbeiter:innen erfahren, was sich geändert hat; bei einer großen Änderung eine kurze Schulung (`03`).

Dringende Behebungen folgen denselben Schritten, nur früher. Die Sicherheitsupdates von Ubuntu installieren sich selbst (Betriebshandbuch, „Updates“).

## Überprüft

Die Kita-Leitung und der Entwickler sehen sich diese Seite einmal im Jahr an, und immer, wenn sich die Kontakte ändern.
