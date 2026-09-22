# Joy of Learning II Timetable — discovery (2026-09-21)

## Validation target (from school document)

Joy of Learning II - Timetable (2026-27), Classes I & II:

| Date | Class I | Class II |
|------|---------|----------|
| 2026-09-30 | Mathematics | EVS |
| 2026-10-01 | Study Holiday | Study Holiday |
| 2026-10-03 | Computer Science | Computer Science |
| 2026-10-05 | Hindi | English |
| 2026-10-07 | EVS | Mathematics |
| 2026-10-09 | Kannada | Hindi |
| 2026-10-12 | English | Kannada |

## Where it lives

| Channel | Result |
|---------|--------|
| NeverSkip Content Library `fetchcontentlib` (live, 124 items) | **No** title matching Timetable / Newsletter / Joy of Learning II Timetable |
| NeverSkip Calendar `fetchcalenderapi` | `D: []` — **no events** |
| NeverSkip Daily Notices | Mentions WS-II practice papers only — **no timetable grid** |
| Dedicated timetable/planner API | **None** for this parent account |
| Grade 1 September newsletter PDF | **YES** — image page titled `JOY OF LEARNING, WORKSHEET – II TIMETABLE` (page 7 of `public/newsletters/grade1-newsletter-september-2026.pdf`) |

The newsletter is catalogued in the SchoolPulse Content Library snapshot ([`data/content-library.json`](../../data/content-library.json) id `cl-nl-sep-2026`) as originating from NeverSkip Parent Portal Content Library, but the **live** `fetchcontentlib` result set does **not** currently return that newsletter object (local PDF path only).

## Classification

- **Structured NeverSkip timetable API:** not available.
- **Canonical school document:** September Grade 1 newsletter PDF, timetable page (image).
- **Sync strategy:** extract structured days from that document into `ImportedJolSchedule` / `ImportedJolScheduleDay` with provenance (source document id + content hash + syncedAt). Mark version **active**. Do not use `data/info/joy-of-learning.json` (WS-I July) for current Dates.
- When a Timetable-titled PDF later appears in live Content Library, prefer that NeverSkip `sourceId` / CDN URL.

## Honest NeverSkip comparison

Live NeverSkip XHR/API responses **do not** contain the seven date rows as JSON. The values exist only inside the newsletter timetable **image**. SchoolPulse therefore syncs by extracting from the newsletter document (school source of truth for JoL II dates), not by inventing UI constants.

## Implementation status (2026-09-21)

| Item | Status |
|------|--------|
| Extract + hash PDF | `lib/neverskip/jol-timetable-extract.ts` |
| Upsert active schedule | `lib/neverskip/jol-timetable-sync.ts` → `ImportedJolSchedule` |
| Wired into browser sync | `scripts/sync-neverskip-browser.ts` |
| JoL Dates UI | `app/joy-of-learning/page.tsx` reads `jolSchedule` from canonical loader |
| Static July WS-I | Not used for Dates (file may remain for archive only) |
| Neon active schedule | `sourceId=cl-nl-sep-2026`, 7 days, matrix matches validation target |
| Vitest | `tests/neverskip/jol-timetable.test.ts` |
| Oracle production worker | **NOT VERIFIED** (SSH unavailable); will pick up JoL timetable sync once this commit is deployed and `run-sync.sh` runs `sync:neverskip:browser` |
