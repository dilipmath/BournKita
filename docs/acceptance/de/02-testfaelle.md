# Testfälle

Der Reihe nach durchgehen: Teil A legt die erfundenen Daten an, mit denen Teil B arbeitet. Jeden Fall abhaken: ✓ (funktioniert wie beschrieben), ✗ (funktioniert nicht, oder nicht wie beschrieben) oder ~ (funktioniert, aber etwas ist seltsam oder schwierig), und ein Wort unter „Notiz“ schreiben. Jedes ✗ und ~ kommt in die Befundliste (`03`). Die R-Nummern sind die des Umfangs von Release 1 (H1).

Namen in Anführungszeichen sind die Schaltflächen und Seiten der App, wie sie auf Deutsch heißen; die englische Fassung dieses Bogens nennt die englischen.

Testende: ______________________  Tablet: ____________  Datum: ____________

## A. Einrichten (Admins, etwa 1 Stunde)

| Nr. | R | Tun | Erwartet | ✓ ✗ ~ | Notiz |
|---|---|---|---|:-:|---|
| A1 | R01, R04 | Auf einem Tablet `https://kita.home.arpa` öffnen. Mit dem Konto der Kita-Leitung anmelden. | Keine Zertifikatswarnung. Die Startseite erscheint. | | |
| A2 | R35 | „English“ wählen, die Seite neu laden, dann wieder „Deutsch“ (oder umgekehrt). | Alle Texte wechseln; die Wahl bleibt nach dem Neuladen. | | |
| A3 | R02, R03 | „Mitarbeiterkonten“: für alle Testenden ein Konto anlegen (Rolle Erzieher:in, auf Wunsch eine weitere Admin) und eines für den Gast (Rolle Gast). | Jedes zeigt „Eingeladen – E-Mail noch nicht bestätigt“; alle Testenden bekommen eine Einladung per E-Mail. | | |
| A4 | R02 | Alle Testenden öffnen ihre Einladung, folgen dem Link und wählen ein Passwort (mindestens 12 Zeichen). | „Ihr Passwort ist gespeichert“; das Konto zeigt „Aktiv“. | | |
| A5 | R10 | „Gruppen“: „Monkeys“ (Symbol Affe) und „Butterflies“ (Symbol Schmetterling) anlegen. „Butterflies“ in „Bees“ umbenennen. | Beide erscheinen mit ihrem Symbol; der neue Name erscheint überall. | | |
| A6 | R10 | „Mitarbeiterkonten“: bei allen Erzieher:innen die Monkeys ankreuzen. | Gespeichert; alle Erzieher:innen arbeiten in den Monkeys. | | |
| A7 | R06 | „Kinder“ → „Neues Kinderprofil“: Lena Weber (Mädchen, geboren 14.03.2022, Sprachen Deutsch und Türkisch, vegetarisch, malt gern). Auf ihrem Profil die Gruppe Monkeys wählen. Ebenso für Noah Fischer, Mia Schmidt, Sofia Wagner, und Emil Becker, **geboren am heutigen Datum vor vier Jahren**. | Jedes Profil zeigt das Eingetragene und die Gruppe; die Seite der Monkeys listet alle fünf. | | |
| A8 | R06 | Lena bearbeiten: ihre Interessen ändern. | Die Änderung erscheint. | | |
| A9 | R09 | Lena → „Eltern“ → „Elternteil hinzufügen“: Anna Weber, eine Adresse, eine Telefonnummer. Ben Weber (Monkeys) anlegen und dieselbe Anna Weber mit ihm verknüpfen („Eingetragenen Elternteil suchen“). | Anna erscheint auf beiden Profilen; ändert man ihre Telefonnummer, erscheint das auf beiden. | | |
| A10 | R18 | Lena: „Allergie oder Erkrankung hinzufügen“: Allergie, Erdnüsse, „Notfall-Pen im Büro“. Noah: Erkrankung, Asthma, „Spray in seiner Tasche“. | Ein rotes Banner oben auf jedem der beiden Profile. | | |
| A11 | R19 | Lena: „Notfallkontakt hinzufügen“ (Erika Weber, Großmutter, eine Telefonnummer) und „Abholberechtigte Person hinzufügen“ Tom Krause (Nachbar), **mit einem Foto**, auf dem Tablet aufgenommen. | Beide erscheinen; Tom mit seinem Foto. | | |
| A12 | R22 | Lena: „Einwilligungen“ → die Einwilligungen für Fotos und für Datenschutz, heute erteilt, eintragen. Noah: nur die Einwilligung für Ausflüge eintragen. | Lena: Fotos und Datenschutz „erteilt seit“ heute; Noah: Fotos „nicht erteilt“. | | |
| A13 | R06, R22 | Lena: „Foto hinzufügen“ (ein Spielzeug, kein Kind). Noahs Fotos ansehen. | Lenas Foto erscheint schnell in ihrer Galerie. Noah: der Hinweis auf die fehlende Foto-Einwilligung, und kein „Foto hinzufügen“. | | |
| A14 | R22 | Lena: den Widerruf ihrer Foto-Einwilligung heute eintragen. Ihre Galerie ansehen. Dann die Einwilligung wieder eintragen. | Nach dem Widerruf sind ihre Fotos sofort verborgen; nach der neuen Einwilligung wieder da. | | |
| A15 | R13 | „Kalender“ → „Feiertage und Ferien“: die Feiertage der Region übernehmen, dann ihre Schulferien (zwei .ics-Dateien). | „… übernommen“; sie erscheinen im Kalender an ihren Tagen. | | |

## B. Alltag (Erzieher:innen an Tablets, etwa 2 Stunden)

Alle Erzieher:innen melden sich an einem Tablet mit ihrem eigenen Konto an. Admins schauen zu oder führen die mit Admin markierten Fälle durch.

| Nr. | R | Wer | Tun | Erwartet | ✓ ✗ ~ | Notiz |
|---|---|---|---|---|:-:|---|
| B1 | R15, R33 | Erzieher:in | Die App zum Startbildschirm des Tablets hinzufügen (Menü des Browsers → „Zum Startbildschirm hinzufügen“ / „App installieren“), von dort öffnen. | Sie öffnet sich wie eine App, ohne die Adressleiste des Browsers. | | |
| B2 | R10 | Erzieher:in | Auf der Startseite die Monkeys wählen. | Die Seite der Monkeys: das heutige Datum, die Zahlen, alle Kinder der Gruppe. | | |
| B3 | R18 | Erzieher:in | Welche Kinder haben eine Allergie oder Erkrankung? | Lena und Noah tragen das Zeichen „Achtung“. | | |
| B4 | R24 | Erzieher:in | Wer hat Geburtstag? | „Geburtstag heute: Emil Becker“. | | |
| B5 | R21 | Erzieher:in | Emil, Lena und Noah „Ankommen“ lassen. Dann Lena „Abholen“. Dann „Rückgängig“ bei Lena. | Die Zahlen und die Zeile jedes Kindes ändern sich jedes Mal („Da seit …“, „Abgeholt um …“); nach Rückgängig ist Lena wieder da. | | |
| B6 | R21 | Erzieher:in | Sofia: „Abwesend“, Grund Krank, von morgen bis übermorgen. | Ihre Abwesenheit erscheint auf ihrem Profil unter „Abwesenheiten“. | | |
| B7 | R18, R19 | Erzieher:in | Lenas Profil öffnen. | Das Banner mit Allergien und Erkrankungen oben; ihre Allergie neben ihren Essensvorlieben; „Wer abholen darf“ zeigt Tom Krause mit seinem Foto. | | |
| B8 | R06 | Erzieher:in | Können Sie Lenas Profil ändern oder löschen? | Nein: Erzieher:innen haben keine Schaltfläche „Bearbeiten“ oder „Löschen“. | | |
| B9 | R06 | Erzieher:in | „Kinder“: nach „we“ suchen. | Lena und Ben Weber werden gefunden. (Nach Gruppe: die Seite der Gruppe, B2.) | | |
| B10 | R23 | Erzieher:in | Noah: „Vorfall melden“: Knie an der Rutsche aufgeschürft, Pflaster, Vater telefonisch informiert. | „Vorfall gemeldet.“; er lässt sich danach nicht mehr ändern. | | |
| B11 | R23 | Admin | „Vorfallbuch“: Noahs Vorfall finden, „Nachtrag hinzufügen“. | Der Nachtrag erscheint unter dem Vorfall, mit Angabe, wer ihn wann geschrieben hat. Das „Vorfallbuch“ von Erzieher:innen zeigt nur ihre eigenen Meldungen. | | |
| B12 | R20 | Erzieher:in | Feuerübung: die „Notfallliste (PDF)“ der Monkeys. Auf dem Drucker im Büro drucken. Dann die „Notfallliste der ganzen Kita (PDF)“ auf der Startseite. | Zeigt die Kinder, die jetzt da sind (Emil, Lena, Noah; nicht Ben, Mia oder Sofia), mit ihren Allergien und Erkrankungen und wen man anruft; auf Papier lesbar. | | |
| B13 | R12 | Erzieher:in | „Aufgaben“: „Aufgabe hinzufügen“ „Klebestifte kaufen“. Mit dem Finger nach In Arbeit ziehen, dann nach Erledigt. | Sie wandert jedes Mal und bleibt dort nach dem Neuladen. | | |
| B14 | R12 | Erzieher:in | Drei weitere Aufgaben hinzufügen; mit „Bearbeiten“ einer davon jemanden geben („Wer macht es“), ein Fälligkeitsdatum und ein Schlagwort. „Backlog“: die wichtigste nach oben schieben (ziehen, oder „Hoch“). | Die Reihenfolge und die Angaben bleiben nach dem Neuladen. | | |
| B15 | R13 | Erzieher:in | „Kalender“ der Monkeys → „Termin hinzufügen“: Puppentheater übermorgen, 10:00–11:00, Erinnerung „1 Tag vorher“. Monat, Woche und Liste ansehen. | Es erscheint übermorgen um 10:00 in allen drei Ansichten; der Monat zeigt auch die Feiertage und Emils Geburtstag (heute). | | |
| B16 | R13 | Erzieher:in | „Termin hinzufügen“: Morgenkreis jeden Montag, 09:00–09:30, Wiederholung jede Woche. Dann mit „Bearbeiten“ auf 09:15 verschieben, dann „Löschen“. | Er erscheint an jedem Montag, dann um 09:15; nach dem Löschen an keinem Montag. | | |
| B17 | R13 | Admin | „Kalender“ der ganzen Kita: „Termin hinzufügen“ „Elternabend“, Für: Ganze Kita. | Erscheint im Kalender der ganzen Kita und in dem jeder Gruppe. | | |
| B18 | R16 | Erzieher:in | „Feedback“ (auf einer beliebigen Seite): Art Idee, „Das ist ein Test“. | „Danke! Ihr Feedback wurde gesendet.“; der Entwickler bekommt die E-Mail mit der Seite. | | |
| B19 | R01 | Gast | Mit dem Gast-Konto anmelden. Sich umsehen. | Nur der Kalender, nur zum Lesen, mit den Terminen der ganzen Kita und den Feiertagen; kein Kind, keine Termine einer Gruppe, kein Name; keine Geburtstage. | | |
| B20 | R01, R03 | Erzieher:in | Im Browser (nicht in der installierten App) versuchen, die Mitarbeiterkonten, das Protokoll und das Archiv zu öffnen (sie stehen nicht im Menü; die Adressen `/staff`, `/audit-log`, `/archive` bei der Admin erfragen). | Jedes Mal „Nur Admins …“. | | |
| B21 | R02 | Erzieher:in | Abmelden. „Passwort vergessen?“: einen Link anfordern, ihm aus der E-Mail folgen, ein neues Passwort wählen, damit anmelden. | Klappt; das alte Passwort nicht mehr. | | |
| B22 | R01 | Erzieher:in | Das Tablet 30 Minuten nicht berühren, dann etwas antippen. | Die App verlangt wieder die Anmeldung. | | |
| B23 | R01 | Erzieher:in | Abmelden. Fünfmal hintereinander mit falschem Passwort anmelden, dann mit dem richtigen. | Auch das richtige Passwort wird abgewiesen, 15 Minuten lang (die App erklärt die Sperre); ein neues Passwort (wie in B21) hebt sie sofort auf. | | |

### Admin-Fälle

| Nr. | R | Tun | Erwartet | ✓ ✗ ~ | Notiz |
|---|---|---|---|:-:|---|
| B24 | R03 | „Mitarbeiterkonten“: eine Erzieher:in zur Admin machen und zurück. Das Konto einer Erzieher:in deaktivieren, während sie angemeldet ist. | Die Rollen ändern sich; die deaktivierte Erzieher:in ist beim nächsten Tippen draußen und kann sich nicht mehr anmelden. „Reaktivieren“ lässt sie wieder herein. Das Protokoll zeigt weiter, was sie getan hat. | | |
| B25 | R08 | Sofias Profil löschen („Löschen“, dann „Profil löschen“). „Archiv“ öffnen. Sie wiederherstellen. | Sofia verschwindet aus den Kindern und den Monkeys, steht im Archiv mit dem Datum, an dem sie endgültig gelöscht wird, und ist nach dem Wiederherstellen mit allen Daten zurück. | | |
| B26 | R34 | „Protokoll“: nach einer Erzieher:in filtern, dann „Protokoll zu diesem Kind“ auf Lenas Profil öffnen. | Zeigt, wer Lenas Daten wann angesehen und geändert hat. | | |
| B27 | R34 | Die Seite von Anna Weber (ihr Name auf Lenas Profil) → „Alle Daten exportieren (ZIP)“. Das ZIP an einem Laptop öffnen. | Es enthält die Daten von Anna, Lena und Ben und Lenas Fotos. | | |
| B28 | R34 | Auf der Seite von Anna Weber „Alle Daten löschen“ → „Endgültig löschen“. | Anna, Lena und Ben sind endgültig weg, auch aus dem Archiv und der Tagesansicht; das Protokoll zeigt „Elternteil Nr. …“ „Endgültig“. | | |

## C. Am nächsten Morgen (Entwickler oder IT)

| Nr. | R | Tun | Erwartet | ✓ ✗ ~ | Notiz |
|---|---|---|---|:-:|---|
| C1 | R04 | `dc logs --tail 20 backup` | „Nightly backup … done.“ von 01:30. | | |
| C2 | R24 | Die Erzieher:innen der Monkeys sehen am nächsten Morgen (dem Tag vor dem Puppentheater) ab 07:00 in ihre E-Mails. | Alle bekommen eine Erinnerungs-E-Mail. | | |
| C3 | R04 | `journalctl -u kita-health-check --no-pager \| tail` | „all well“ (oder nur erwartete Warnungen, z. B. noch keine Platte für außer Haus). | | |
| C4 | R04 | An einem Handy mit mobilen Daten (WLAN aus) `https://kita.home.arpa` öffnen. | Es öffnet sich nicht: Die App ist nur innerhalb der Kita erreichbar. | | |
