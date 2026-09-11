# Parent onboarding

How parents get SchoolPulse accounts and when they can acknowledge homework/notices.

## What exists today

1. **Self-registration** at [`/sign-up`](../app/sign-up/page.tsx) creates a `User` with `role=parent` and a bcrypt `passwordHash`.
2. Sign-in remains at [`/login`](../app/login/page.tsx) (`/sign-in` redirects there).
3. **No automatic child or class access** on signup. New parents cannot acknowledge until the school links them.
4. Linking is modeled as:
   - `Student` → belongs to a `Class` (`name` / `section`, e.g. `I-A`)
   - `ParentStudent` with `status`: `pending` | `approved` | `rejected`
5. Acknowledgements require **≥1 approved** `ParentStudent` and a **class label match** against NeverSkip `sectionsJson` / `classesJson` (normalized codes like `I-A`).

Browse of `/homework` and `/notices` stays publicly readable; only the acknowledgement write path is gated in this cycle. Production may later gate list views the same way.

## Operator workflow (until admin UI exists)

1. Ensure a `Class` row exists whose `section` or `name` matches NeverSkip labels (e.g. `I-A`).
2. Create `Student` rows (script or future admin) for the roster.
3. Parent registers at `/sign-up` (or seed with `npm run seed:parent`).
4. Approve the link:

```bash
LINK_PARENT_EMAIL=parent@example.com \
LINK_STUDENT_NAME="Child Name" \
LINK_CLASS_SECTION=I-A \
LINK_STATUS=approved \
LINK_CREATE_STUDENT=1 \
npm run link:parent-student
```

Or with an existing student id:

```bash
LINK_PARENT_EMAIL=parent@example.com \
LINK_STUDENT_ID=clxxxxxxxx \
LINK_STATUS=approved \
npm run link:parent-student
```

5. Parent signs in and can acknowledge items that target their linked class.

Until step 4, they can log in but see a calm “school still needs to link your child” message instead of Acknowledge.

## Production gaps (honest)

| Gap | Notes |
|-----|--------|
| No self-serve “pick my child” | Prevents claiming arbitrary students |
| Linking via script | Full invite/approve admin UI still needed |
| Label alignment | `Class.section`/`name` must match NeverSkip section/class strings |
| Public lists | Homework/notices pages are still readable by anyone; ack is the gated write |
| NeverSkip ↔ Class mapping | Roster import and mapping tooling still needed |

## Related

- Seed parent only: `npm run seed:parent` ([`scripts/seed-parent-user.ts`](../scripts/seed-parent-user.ts))
- Teacher engagement still deferred: [`TEACHER_ENGAGEMENT_PREREQUISITES.md`](./TEACHER_ENGAGEMENT_PREREQUISITES.md)
