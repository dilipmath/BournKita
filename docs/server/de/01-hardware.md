# Hardware

Die App ist klein: eine Kita, einige Dutzend Kinder, eine Handvoll Tablets. Wichtig ist, dass sie jahrelang leise läuft, einen Stromausfall übersteht und nie Daten verliert.

## Was gekauft wird

| Was | Empfehlung | Warum |
|---|---|---|
| **Server** | Ein lüfterloser oder leiser Mini-PC: 4 oder mehr Kerne (Intel N100 oder besser), **16 GB RAM**, **512 GB NVMe-SSD**, Gigabit-LAN-Anschluss, TPM-2.0-Chip, 2+ USB-3-Anschlüsse | Docker, PostgreSQL und der PDF-Druck brauchen wenig; die SSD hält Datenbank und Fotos; Kabel ist zuverlässiger als WLAN |
| | Kein NAS, außer es läuft Docker auf einem normalen Linux und die Datenbank bleibt auf eigener Platte | Die Datenbank darf nie auf einem Netzlaufwerk liegen |
| **USV** (unterbrechungsfreie Stromversorgung) | Eine kleine Line-Interactive-USV, etwa 600–900 VA, mit **USB-Anschluss**, die Linux (NUT) unterstützt (die meisten Modelle von APC, Eaton, CyberPower) | Hält Server und Router bei kurzen Ausfällen am Laufen und fährt den Server bei langen sauber herunter |
| **Sicherungsplatte** (zweite Platte, nächtlich) | Eine externe USB-SSD oder -Festplatte mit 1 TB, immer angeschlossen | Nächtliche Sicherungen von Datenbank und Fotos (die letzten 14) |
| **Platten für außer Haus** (wöchentlich) | **Zwei** USB-Sticks oder -Platten mit 128 GB oder mehr, jede Woche getauscht | Einer geht mit einer vertrauenswürdigen Person nach Hause, während der andere steckt; die wöchentliche Sicherung ist verschlüsselt, ein verlorener Stick verrät nichts |
| **Netzwerkkabel** | Eines, vom Server zum Router oder Switch | — |
| **Tresor oder abschließbarer Schrank** | Für die gedruckten Schlüssel (Festplatten-Passphrase, App-Schlüssel, Sicherungsschlüssel) und die Platte außer Haus | Ohne die Schlüssel ist keine Sicherung lesbar; mit ihnen für jeden |

Kosten, grob (2026): Mini-PC 250–400 €, USV 100–150 €, Platten 100–150 €. Zusammen etwa 450–700 €.

## Wo er steht

- Ein Schrank oder Büro mit Strom, Netzwerkkabel zum Router, etwas Luft, außer Reichweite der Kinder, nicht auf dem Boden (Wasser).
- Die USV versorgt den Server **und** den Router, damit die Tablets bei einem kurzen Ausfall weiterlaufen.

## Checkliste

- [ ] Server gekauft (Modell: ______________________)
- [ ] USV gekauft und per USB angeschlossen (Modell: ______________________)
- [ ] Sicherungsplatte gekauft
- [ ] Zwei Platten für außer Haus gekauft
- [ ] Platz gewählt: ______________________
- [ ] Tresor oder abschließbarer Schrank für Schlüssel und die Platte außer Haus
