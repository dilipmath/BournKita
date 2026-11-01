# Gestaltungsregeln

Die Regeln, denen die Bildschirme der App folgen (`frontend/src/index.css`), nachgemessen. Wo die App eine Regel noch nicht erfüllt, steht es dabei.

## Für wen

Mitarbeiter:innen mit Grundkenntnissen am Computer, ein Tablet in einer Hand, oft in Eile, manchmal mit Lesebrille. Also: groß, einfach, fehlertolerant.

## Regeln

| Regel | Wert in der App | Gemessen | Erfüllt? |
|---|---|---|:-:|
| **Schriftgröße** | Grundschrift 20px, Überschriften größer; nichts unter 16px | Beschriftungen im Monatskalender und manche Notizen sind 16px (0,8rem) | ✓ |
| | | **Termine im Monatskalender auf dem Handy: 14px** (0,7rem, Bildschirme bis 700px Breite) | ✗ |
| **Tippflächen** | Jeder Knopf, jeder Link-Knopf und jedes Feld mindestens 48 × 48px (über den 24px aus WCAG 2.5.8 und den 44px von Apple) | Knöpfe und Felder 48px; Ankommen und Abholen 64px; Zeilen der Kinderliste 56px | ✓ |
| | Kästchen | Das Kästchen selbst ist 28 × 28px; die ganze Zeile mit Beschriftung ist 48px und antippbar | ✓ |
| | | **Termine und Geburtstage im Monatskalender: 32px hoch** (Wochen- und Listenansicht sind größer) | ✗ |
| **Kontrast von Text** (WCAG 1.4.3, 4,5:1) | Text #1f2328 auf #fdfbf7 | 15,3:1 (dunkler Modus 14,7:1) | ✓ |
| | Grün (Akzent) #2f6f4f auf dem Hintergrund; helle Schrift auf grünen Knöpfen | je 5,8:1 (dunkler Modus 8,6:1) | ✓ |
| | Rot (Allergien, Gefahr) #b42318 auf dem Hintergrund | 6,4:1 (dunkler Modus 7,7:1) | ✓ |
| **Kontrast von Umrissen** (WCAG 1.4.11, 3:1 für das, was zeigt, wo ein Feld oder Knopf ist) | Rand #c9c4ba auf dem Hintergrund und auf Karten | **1,7:1** (dunkler Modus 1,9 bis 2,1:1) | ✗ |
| **Fokus** | Ein deutlicher Rahmen um das, was den Tastaturfokus hat | 3px-Rahmen in der Akzentfarbe | ✓ |
| **Symbole mit Text** | Nie ein Symbol allein: Gruppensymbole stehen neben dem Namen der Gruppe; Allergien zeigen z. B. „⚠ Allergien: Peanuts“ | **Im Monatskalender zeigen Termine einer Gruppe nur ihr Symbol** (der Name ist nur für Bildschirmleser da) | ✗ |
| **Gruppensymbole** | Jede Gruppe hat ein Tier- oder Pflanzensymbol, in der Gruppenauswahl, in „Heute“ und im Kalender | — | ✓ |
| **Nie nur Farbe** | Der Status steht auch als Text da: „Da seit 08:12“, „Abwesend: krank“, „Abgeholt um 15:30“ | — | ✓ |
| **Einfache Worte** | Die Begriffe des Glossars (Kind, Gruppe, Allergien und Erkrankungen, Abholberechtigte …), auf Deutsch und Englisch | — | ✓ |
| **Zweiter Schritt vor allem, was Daten löscht** | Löschen fragt nach; endgültiges Löschen sagt, dass es nicht rückgängig zu machen ist | — | ✓ |
| **Dunkler Modus** | Folgt der Einstellung des Geräts | — | ✓ |

## Noch nicht erfüllt (nach dem Test beheben, wenn er es bestätigt)

1. **Kontrast von Umrissen:** Ränder von Feldern und Knöpfen sind zu hell (1,7:1, nötig 3:1). Ein dunklerer Rand, z. B. #8a8478 (3,6:1), würde reichen.
2. **Einträge im Monatskalender** (Termine, Geburtstage) sind 32px hoch, mit 14px Schrift auf dem Handy, und Termine einer Gruppe zeigen nur ihr Symbol. Größere machen das Monatsraster viel höher; Wochen- und Listenansicht sind die Ausweichmöglichkeit. Im Test prüfen, ob die Mitarbeiter:innen damit zurechtkommen.

## Worte und Aufbau

- Eine Hauptaktion pro Karte, in Grün; weitere Aktionen als umrandete Knöpfe.
- Listen und Karten auf dem Handy in einer Spalte, auf dem Tablet in mehreren.
- Daten ausgeschrieben („Montag, 4. Januar“), Uhrzeiten in der Ortszeit der Kita.
