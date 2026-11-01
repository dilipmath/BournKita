# Test plan

## Goal

Show that Release 1 does what the Kita needs, on the Kita's own server and tablets, used by the people who will use it every day. The test is passed when the Kita manager signs it off (`04`).

## Who

| Who | Role in the test | In the app |
|---|---|---|
| The Kita manager | Decides; signs off | Admin |
| 1 or 2 more Admins (e.g. the deputy) | Set up the made-up data; Admin cases | Admin |
| 2 to 4 Teachers, at least one unsure with computers | Everyday cases | Teacher |
| One of them, for one case | The Guest view | Guest |
| The developer (or IT) | Runs the server, answers questions, writes the findings down | — |

## When and where

- Half a day (about 4 hours) on a normal working day, at a quiet time: part A (setting up) about 1 hour, part B (everyday) about 2 hours, rating and sign-off about 1 hour.
- In the Kita, on the Kita's own Wi-Fi, with the tablets the staff will use and the office printer.
- Part C (backups and emails the next morning) is checked by the developer or IT on the following day.

## Ready first

| | Ready? |
|---|:-:|
| H1: the Release 1 scope signed off, with its Must and Should changes made | ☐ |
| H3: the changes marked "before go-live" in the usability findings made | ☐ |
| H4: the server installed and its checklist ticked (`docs/server`), with the release to be tested running | ☐ |
| H5: the security review's open points known (S1, S2, S5 on GitHub); none of them stops the test | ☐ |
| The first Admin account exists (the Kita manager's) | ☐ |
| The tablets trust the server's certificate and open `https://kita.home.arpa` | ☐ |
| Every tester can read their own email on the day (for the invitation) | ☐ |
| `02` printed, one per pair of testers; `03` printed once | ☐ |
| The region's public holidays and school holidays as two .ics files downloaded, for case A15 | ☐ |
| A few photos on a tablet to upload (not of real Children: e.g. toys, the garden) | ☐ |

## The data

**Made-up only.** The test cases bring their own Children, Parents and Groups (Lena Weber, the Monkeys, …). Never enter a real Child, Parent or health detail: the server is cleared afterwards, but the backups keep what was entered for up to 8 weeks.

The testers' own Staff accounts use their real email addresses (the invitation must reach them); they are removed with the rest afterwards.

## Results

Each case is ticked ✓, ✗ or ~, as the test cases (`02`) explain. Every ✗ and ~ becomes a line in the findings log (`03`), in the testers' own words.

## Rating findings

At the end, together, each finding gets one rating:

| Rating | Means | For go-live |
|---|---|---|
| **Blocker** | Wrong or lost data, a safety risk (e.g. a wrong Alert, a wrong Pick-up person), data shown to someone who must not see it, or a Must case that cannot be done | Must be fixed and retested before go-live |
| **Major** | A case can be done only with help or a detour, or staff would avoid the app because of it | Fixed before go-live, unless the Kita manager accepts it in `04` with a date |
| **Minor** | Works, but is awkward, unclear or ugly | After go-live |
| **Idea** | Something new, not part of Release 1 | Collected for Release 2 |

## Passed when

- every case in part A and B has been run,
- no Blocker is left open,
- every Major is fixed or accepted in writing by the Kita manager, with a date,
- and the Kita manager signs `04`.

A fix is retested with the case that found it (only that case, unless it touches others) before go-live.

## Not tested in the session

The purge after the retention period (12 months), crash reports and the restore of a backup cannot be tried in an afternoon. Automatic tests check them on every change; the restore is also tried on the Kita server at go-live (H7).

## Afterwards: clearing the server

Only after part C and the sign-off: the made-up data must not go live. With the developer or IT, on the server (the commands of `docs/server`):

```
cd /opt/kita && dc down
docker volume rm kita_db-data kita_photos     # the test data and photos; keep kita_caddy-data (the tablets' certificate)
sudo rm -rf /mnt/backup/kita/db /mnt/backup/kita/photos     # the nightly backups of the test data
sudo rm -f /mnt/offsite/kita-*.tar.age                         # the weekly ones
```

Do the last line on the other off-site drive too, if it was plugged in since the test. If the photos are on a share (`KITA_PHOTO_DIR`), empty that folder too. Then `dc up -d --wait` and create the first Admin again (README, "Run in production"): the server is ready for go-live (H7).
