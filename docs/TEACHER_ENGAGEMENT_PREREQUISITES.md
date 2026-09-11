# Teacher engagement — prerequisites (NOT implemented)

SchoolPulse does **not** yet have a safe way to show teacher analytics such as:

> 18 / 24 parents acknowledged

## Why deferred

The application currently lacks:

1. **Teacher authentication** (Auth.js parents only in this cycle)
2. A live **class/section model** linked to homework/notices (targeting is JSON string arrays only)
3. **Teacher ↔ class membership**
4. **Parent/student ↔ class relationship** (partially started: `Student` + `ParentStudent` with approved status; acknowledgements are gated, but teacher-facing denominators and admin UI are still missing)
5. A reliable **eligible-parent denominator**

Without those, any “X of Y” engagement rate would be fabricated.

## Future work

When the above exists:

- Aggregate counts from `HomeworkAcknowledgement` / `NoticeAcknowledgement`
- Denominator = parents enrolled for that class/section
- Prefer aggregates over individual parent lists unless privacy policy allows

Do not ship fake teacher dashboards before this foundation exists.
