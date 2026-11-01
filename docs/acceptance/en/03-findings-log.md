# Findings log

One line per finding: every ✗ and ~ from the test cases, and anything else the testers notice. Write what they say, in their words. Rate them together at the end (Blocker, Major, Minor, Idea: see the test plan, `01`).

| # | Case | Who found it | What happened (in their words) | Rating | Decision | Issue |
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

**Decision** is one of: *fix before go-live* · *fix after go-live* · *accepted* (Major only, with the Kita manager's date in `04`) · *Release 2* (Ideas) · *no change* (with the reason).

## From findings to issues

Afterwards, every finding except "no change" becomes a GitHub issue on `dilipmath/BournKita` (Claude does this from the filled-in sheet), as a sub-issue of #33, with its number written into the last column:

| Rating | Labels | Blocks go-live (#34)? |
|---|---|---|
| Blocker | `bug`, `ready-for-agent` | yes |
| Major, fix before go-live | `bug` or `enhancement`, `ready-for-agent` | yes |
| Major accepted, or Minor | `bug` or `enhancement`, `needs-triage` | no |
| Idea | `enhancement`, `needs-triage`, "Release 2" in the title | no |

The issue quotes the tester's words and names the case; it never names a real Child (there are none in the test).

When a "before go-live" issue is fixed and the new version is on the server, rerun the case that found it and tick it here:

| Issue | Retested by | Date | ✓ |
|---|---|---|:-:|
| # | | | |
| # | | | |
| # | | | |
| # | | | |
