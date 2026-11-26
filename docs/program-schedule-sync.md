# Program schedules: proposed from HubEasy, published by Simon

Staff keep program times in **HubEasy**. The website reads them from `src/content/program-schedules.json`
(stage W2). A scheduled job compares HubEasy with that file and, when they differ, opens **one pull request**
listing the changes in plain English. **Only Simon's merge publishes them.** The job never pushes to `main`.

This is the opposite of the [service directory sync](service-directory-sync.md), which commits straight to
`main`. Program times are the page content people act on, so a person looks at every change first.

## How it flows

1. A staff member edits a program's day, time, mode or note in HubEasy.
2. At 7 and 37 minutes past each hour (or when run by hand), `.github/workflows/sync-program-schedules.yml` runs
   `scripts/sync-program-schedules.mjs`. It reads the feed, checks it, maps it to the rows the pages use, and
   compares them with the file.
3. If something changed, the workflow force-updates the branch `sync/program-schedules` and opens (or updates) the
   one pull request from it. The pull request body is the change list, for example:
   `AA: Friday 10:00am to 11:30am moved to Life Choices (In-person)`.
4. Simon merges, and the site rebuilds as usual. Or Simon closes it, and the site stays as it is. A closed pull
   request is not reopened for the same changes; a later, different change opens a new one.
5. If HubEasy matches the site again (a staff member fixed it), the open pull request is closed as stale.

The same run also writes the change list to the job summary and to `sync-report.md`.

## The feed

`https://oakdene.hubeasy.com.au/api/public-programs.php` (built by HubEasy#1103; override with the
`HUBEASY_PROGRAMS_FEED_URL` environment variable). Public, read-only, no sign-in.

```json
{ "source": "HubEasy programs", "generatedAt": "2026-11-26T10:00:00+11:00",
  "sections": { "aa": [ { "program": "AA Meeting (Spanish)", "day": "Tuesday", "start": "17:00", "end": "18:30",
                          "mode": "face_to_face", "frequency": "weekly", "public_note": "Spanish Speaking" } ] } }
```

Sections: `life-choices`, `aa`, `ga`, `dbt`. `day` is a full weekday name; `start` and `end` are 24-hour `HH:MM`.

## Wording

The sync adds no wording beyond this table. It is the only new public text, and it reaches the site only when
Simon merges a pull request that contains it.

| Feed | On the site |
|---|---|
| `mode` `face_to_face` | Format: **In-person** (Life Choices) |
| `mode` `zoom` | Format: **Online / Zoom Only** (Life Choices) |
| `mode` `hybrid` | Format: **In-person or Zoom** (Life Choices) |
| `frequency` `weekly` | nothing added |
| `frequency` `fortnightly` / `monthly` | **Fortnightly** / **Monthly** appended to notes, after any public note, separated by a comma |
| `frequency` `adhoc` | held back: not written, listed in the pull request under "Held back" |
| `public_note` | Life Choices: the Audience column. AA, GA and DBT: the Notes column |

AA, GA and DBT pages have no Format column, so `mode` is not shown for them. Life Choices does not show a Notes
column, so Fortnightly or Monthly on a Life Choices row is stored in the file but not displayed until its page
shows notes. Rows are sorted Monday-first by start time, as the pages expect.

## Guards

Each guard writes nothing to the site file and posts **one** message. The message is a comment on the open sync
pull request, or, if none is open, on a single issue titled "Program schedule sync needs attention" (label
`program-sync`). Later runs edit that comment rather than adding another, and mark it **Cleared** when the sync
works again. The run itself stays green, so a problem does not become a red run every 30 minutes.

| Guard | Stops when |
|---|---|
| Not a feed | the response is not JSON, has no `sections` object, or could not be reached (this is also what happens before HubEasy#1103 is live) |
| Malformed row | a day that is not a weekday name, a time that is not `HH:MM`, a row that ends before it starts |
| Unknown value | a `mode`, `frequency` or section name not in the tables above |
| Empty section | a section would have no rows |
| Halved | fewer than half as many rows as the site has now |

## Turning it on

Scheduled runs only happen when the repository variable `PROGRAM_SYNC_ENABLED` is `true`. Set it after the feed
is live and `node scripts/sync-program-schedules.mjs --check` shows what you expect. **Run workflow** works at any
time. To stop it: unset the variable, or `gh workflow disable`, and close the sync pull request.

The repository setting "Allow GitHub Actions to create and approve pull requests" must be on for the pull request
to be opened. Matt owns that setting.

## When a program really ends

The sync never removes the last row of a section, and a guard stops it if a section would empty. To remove a
program that has ended, edit `src/content/program-schedules.json` by hand in a normal pull request. If HubEasy
still lists the program, the next sync will propose it again, so end it in HubEasy too.

## Testing locally

```
node --test scripts/*.test.mjs                                   # all tests
node scripts/sync-program-schedules.mjs --check                  # what would change against the live feed
node scripts/sync-program-schedules.mjs --from feed.json --check # use a saved feed document
```

Fixture feeds are in `scripts/fixtures/program-schedules/`. After a deliberate schedule change, regenerate
`current.json` from the real file; the other fixtures are derived from the same rows.
