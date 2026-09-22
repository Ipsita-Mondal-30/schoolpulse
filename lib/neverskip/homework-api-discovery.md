# NeverSkip homework API discovery

Captured: 2026-09-22 (live session replay + SPA cache)

## Portal page
`https://parent.neverskip.com/default/assignment`  
(Note: this route currently redirects to `/` for the Class I parent session; Class Diary API still works via session + Token.)

## API
`POST https://nskapi.neverskip.com/parentweb/lms/getassignmentsapi`

## Root cause
Pages ≥1 were rebuilt with a guessed body using **`limit`** (and missing `sub_id` / `assignment_date`).  
The Angular SPA posts **`limt`** (typo), plus `sub_id` and `assignment_date`.

## Portal POST body (Class Diary — live replay)
```json
{
  "values": "",
  "page": "0",
  "sub_id": "",
  "assignment_date": 0,
  "pg_key": "CD",
  "works": "",
  "limt": 0
}
```

## Assignments SPA (`pg_key: "AG"`)
Observed in portal JS; live probe returned **0 items** for this parent session.

AG pagination: posted `limt = page * 10`.

## Diff vs previous SchoolPulse default
| Field | Old sync | Portal |
|-------|----------|--------|
| `limit` | 0 → sfile_limit | absent |
| `limt` | absent | `0` (CD) |
| `sub_id` | absent | `""` |
| `assignment_date` | absent | `0` |

## Live probe (2026-09-22, authenticated)
| Body | items | total_count | newest ass_dt |
|------|-------|-------------|---------------|
| old `{limit:0}` | 10 | **137** | 2026-09-17 |
| portal `{limt:0,…}` | 10 | **136** | 2026-09-17 |
| `{works:"H"}` | 10 | 136 | 2026-09-17 |
| `{works:"C"}` | 0 | 0 | — |
| `{pg_key:"AG"}` | 0 | 0 | — |

## Newest assigned date (API truth)
**2026-09-17** (`Learn poem- Bitiya Aayi`). No newer `ass_dt` is returned by `getassignmentsapi` for this session with either the old or portal-shaped body.

## Duplicates / PARTIAL
Cross-page overlaps may leave `unique < total_count`. Sync keeps all unique rows and marks homework **PARTIAL** (does not drop rows to force COMPLETE).
