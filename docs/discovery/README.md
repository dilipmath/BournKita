# Discovery kit for H1 (issue #2): Release 1 scope sign-off

Everything needed to meet the Kita manager and the Teachers, check Release 1 against how they really work, and get the scope signed off. Each sheet comes in English (`en/`) and German (`de/`); print the language each person prefers.

| Sheet (`en/` · `de/`) | For | Use |
|---|---|---|
| `01-interview-kita-manager.md` · `01-interview-kita-leitung.md` | Kita manager | Interview, about 60 minutes |
| `02-interview-teacher.md` · `02-interview-erzieherin.md` | Each Teacher (at least two) | Interview, about 30 minutes each; print once per Teacher |
| `03-roles-and-permissions.md` · `03-rollen-und-rechte.md` | Kita manager | Confirm or change who may do what, as the app works today |
| `04-release-1-scope.md` · `04-umfang-release-1.md` | Kita manager | MoSCoW scope and the written sign-off |
| `05-hardware-and-network.md` · `05-hardware-und-netzwerk.md` | Kita manager or whoever knows the IT | Inventory of PCs, tablets, network and where the server goes |
| `06-open-assumptions.md` · `06-offene-annahmen.md` | Kita manager | The open questions from the Release 1 spec (#1) |

## How to run it

Release 1 is already built, so these are not open-ended discovery meetings: show the app and ask whether it fits.

1. Start the app on a laptop: `docker compose up -d --build --wait`, open http://localhost:8080, create an Admin (see the README) and a few made-up Children, Parents, Groups and Events. Never use real data before H2 (the data-protection assessment) is done.
2. Interview the Kita manager first (sheet 01), then the Teachers (sheet 02). Let them tap through the app on a tablet while you ask.
3. Go through sheets 03 to 06 with the Kita manager. Sheet 04 ends with the signature: that is the written scope confirmation H1 asks for.
4. Write down answers in the sheets themselves: ticks, notes in the margins, "changed: …".

## Afterwards

Give the filled-in sheets (photos or scans are fine) or typed notes to Claude, which then:

- records the workflow notes, Role matrix, scope decisions and inventory on issue #2, and ticks its acceptance criteria;
- updates the open assumptions in the Release 1 spec (#1) with the answers;
- turns every change the Kita asks for into a ticket.

Keep the signed sheet 04: it is the scope sign-off.
