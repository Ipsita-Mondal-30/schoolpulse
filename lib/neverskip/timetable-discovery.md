# NeverSkip timetable discovery (observed 2026-09-21)

## Parent portal menus (DOM)

Visible Student menu labels for this account:

- Assignments
- Class Diary
- Content Library
- Daily notices
- Calendar

**Not present:** Timetable, Planner, Time Table, Schedule.

## Routes

| URL | Result |
|-----|--------|
| `/default/content-library` | Authenticated; triggers `fetchcontentlib` |
| `/default/calendar` | Authenticated; triggers `POST /parentweb/lms/fetchcalenderapi` with body `{}` |
| `/default/planner` | Redirects to `/` as **login** — route not available for this parent |
| `/default/timetable`, `/default/time-table`, `/default/schedule` | Not a live timetable module (no dedicated XHR observed earlier) |

## APIs

### Confirmed (existing sync)

- `POST /parentweb/lms/getassignmentsapi` — homework (not a timetable)
- `POST /parentweb/connect/fetchdailynoticeinfo` — notices
- `POST /parentweb/lms/fetchcontentlib` — Content Library resources/PDFs

### Newly observed

- `POST /parentweb/lms/fetchcalenderapi`
  - Trigger: Calendar page
  - Request: `{}` (application/json)
  - Envelope: `{ S: true, D: [], F: "S" }` for this student on 2026-09-21
  - **D is an empty array** — no calendar events / no period grid / no JOL day subjects in API response
  - Manual probes with `{month,year}` returned `S: false` without browser session context replay quirks; browser-intercepted empty `{}` is the authoritative successful shape

### Not observed

- No `*timetable*` / `*schedule*` parentweb path
- No structured fields for periods, weekday grids, or JOL day-wise subjects

## Content Library vs “timetable”

Live `ImportedJolItem` / Content Library titles include Joy of Learning **practice papers / worksheets** (WS-II), e.g.:

- Joy of learning, WS -II, EVS/Hindi/English/Kannada practice paper…
- Midterm JOL 2 Revision 2 / JOL 2 Revision 1

**Zero** titles containing `timetable`, `newsletter`, or a class period grid.

Static repo snapshot `data/content-library.json` lists Grade 1 newsletters (image-only WS-II timetable noted in `data/september-2026.json` extractionNotes) — those newsletter titles are **not** in the live 117-row `fetchcontentlib` result set.

## Classification (source of truth)

1. **Structured NeverSkip class/JOL timetable API:** **does not exist** for this parent account (no menu, no XHR).
2. **Calendar API:** exists but currently returns **no events** (`D: []`). Sync it as the canonical **event** channel; when NeverSkip publishes events they become SchoolPulse schedule rows.
3. **Content Library PDFs:** canonical **document** channel for JOL materials (practice papers). Tag titles matching timetable/newsletter/JOL schedule keywords when present; do **not** invent day grids from static JSON.
4. **SchoolPulse static** `data/info/joy-of-learning.json` (WS-I July) and `data/timetable.json` are **not** NeverSkip and must not drive live Dates/Timetable UI.

## Comparison (NeverSkip vs SchoolPulse)

| Dataset | Status |
|---------|--------|
| NeverSkip structured timetable (dates/subjects/periods) | **Not published via API** (calendar `D=[]`; no timetable endpoint) |
| NeverSkip Content Library JOL docs | Present (practice PDFs); synced as `ImportedJolItem` |
| SchoolPulse JoL Dates (pre-fix) | Static WS-I July JSON — **deviation** |
| SchoolPulse Timetable page (pre-fix) | Static `timetable.json` — **deviation** |
| SchoolPulse DB timetable model (pre-fix) | None |

Artifacts: `timetable-discovery.json`, `timetable-menu-discovery.json`, `timetable-dom-discovery.json`, `timetable-calendar-discovery.json`, `calendar-api-discovery.json`, `calendar-api-raw-shape.json`.
