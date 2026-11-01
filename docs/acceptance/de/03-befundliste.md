# Befundliste

Eine Zeile je Befund: jedes ✗ und ~ aus den Testfällen und alles andere, was den Testenden auffällt. Aufschreiben, was sie sagen, in ihren Worten. Am Ende gemeinsam bewerten (Blocker, Major, Minor, Idee: siehe den Testplan, `01`).

| Nr. | Fall | Gefunden von | Was passiert ist (in ihren Worten) | Bewertung | Entscheidung | Issue |
|---|---|---|---|---|---|---|
| F1 | | | | | | # |
| F2 | | | | | | # |
| F3 | | | | | | # |
| F4 | | | | | | # |
| F5 | | | | | | # |
| F6 | | | | | | # |
| F7 | | | | | | # |
| F8 | | | | | | # |
| F9 | | | | | | # |
| F10 | | | | | | # |
| F11 | | | | | | # |
| F12 | | | | | | # |

**Entscheidung** ist eines von: *vor dem Start beheben* · *nach dem Start beheben* · *akzeptiert* (nur Major, mit dem Datum der Kita-Leitung in `04`) · *Release 2* (Ideen) · *keine Änderung* (mit Grund).

## Von Befunden zu Issues

Danach wird jeder Befund außer „keine Änderung“ ein GitHub-Issue in `dilipmath/BournKita` (das macht Claude aus der ausgefüllten Liste), als Unter-Issue von #33, mit seiner Nummer in der letzten Spalte:

| Bewertung | Labels | Hält den Start (#34) auf? |
|---|---|---|
| Blocker | `bug`, `ready-for-agent` | ja |
| Major, vor dem Start beheben | `bug` oder `enhancement`, `ready-for-agent` | ja |
| Major akzeptiert, oder Minor | `bug` oder `enhancement`, `needs-triage` | nein |
| Idee | `enhancement`, `needs-triage`, „Release 2“ im Titel | nein |

Das Issue zitiert die Worte der Testenden und nennt den Fall; es nennt nie ein echtes Kind (im Test gibt es keine).

Ist ein „vor dem Start“-Issue behoben und die neue Version auf dem Server, den Fall, der es gefunden hat, erneut durchführen und hier abhaken:

| Issue | Erneut getestet von | Datum | ✓ |
|---|---|---|:-:|
| # | | | |
| # | | | |
| # | | | |
| # | | | |
