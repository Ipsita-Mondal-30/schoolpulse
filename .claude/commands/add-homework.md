# Add Homework

Add homework from a screenshot (Neverskip / parent-app messages) into SchoolPulse and push to main — the whole flow in one command.

Use this whenever the user shares one or more homework screenshots. Extract every homework item, add it to `data/school-homework.json`, build, commit, and push to `main`.

## Steps

1. **Read the screenshot(s)** the user attached in this message. There may be several homework items in one screenshot (each usually shows a Subject icon, Class/section, a date, and a message body starting "Jai Shri Gurudev / Namaste dear parents…").

2. **Extract each homework item.** For every distinct homework post, capture:
   - `subject` — UPPERCASE (e.g. `MATHEMATICS`, `ENGLISH`, `EVS`, `HINDI`, `KANNADA`, `COMPUTER SCIENCE`, `MUSIC`). Use `EVS` (not "Environmental Science") to match existing entries where they use it, but mirror whatever the recent entries use.
   - `sections` — array of class sections like `["I-A"]`. Read the "Classes: I-A, I-B, …" or "Class: I-A" line. If it only says "Class I" with no section, ask or default to `["I-A"]`.
   - `title` — a short human title (e.g. `"Lesson 2 Addition - WB Pg 11"`, `"Show and Tell Activity"`). Summarize; don't dump the whole message.
   - `description` — the useful content, cleaned to a single readable line. Keep page numbers, submission instructions, and any links (e.g. `https://u.nskc.in/...`). Drop pure greetings if they add nothing, but it's fine to keep "Jai Shri Gurudev" style openers if brief.
   - `sentDate` — the date on the post, as `YYYY-MM-DD`. The current year is 2026. A date like `3/7/26` or `03-07-2026` means `2026-07-03` (day/month/year, Indian format).
   - `submissionDate` — ONLY if a due/submission date is mentioned ("submit on Monday 06.07.2026", "last date 08.07.26"). Convert to `YYYY-MM-DD`. Omit the field entirely if no due date is given.
   - `attachmentImage` — only if the homework references an attached picture/chart AND the user provided that image separately; save it under `public/homework/` and set this to `/homework/<file>`. Otherwise omit.

3. **Read `data/school-homework.json`.** It's an array, newest-first. Find the highest existing `sh-N` id.

4. **Add the new entries** at the TOP of the array (newest first), each with the next incrementing id (`sh-<N+1>`, `sh-<N+2>`, …). If a screenshot lists several items under one date, add them all. Preserve exact JSON formatting/indentation of surrounding entries.
   - **Dedupe:** if an item already exists (same subject + sentDate + similar title/description), skip it and say so.

5. **Check for non-homework notices.** If a screenshot also shows an event/competition/date (e.g. "Elocution Finals on 16/07/2026", "Poem Writing Competition"), offer to add it to `data/july-2026.json` `importantDates` too (type `event` or `important`). Only do this for genuine calendar events, not homework.

6. **Build to verify:** run `npm run build` and confirm it compiles (`✓ Compiled successfully`). Fix any JSON errors before continuing.

7. **Commit and push to main.** Author must be the default `Claude <noreply@anthropic.com>`.
   - `git add data/school-homework.json` (plus any event file / attachment image touched).
   - Commit message: `Add <Mon DD> homework entries (sh-A to sh-B)` with a short bullet list of what was added, plus the standard `Co-Authored-By:` and `Claude-Session:` trailers.
   - `git push origin main`. If it fails with HTTP 403 / non-fast-forward: `git fetch origin main && git rebase origin/main` (homework file rarely conflicts; if it does, keep BOTH sets of entries and renumber ids to stay unique and sequential), then `git push origin main` again.

8. **Summarize** what was added: list each new entry (id, subject, sections, sentDate, due date if any), and note anything skipped as a duplicate or any event added.

## Important Notes

- The app shows this JSON directly (the Google Sheet path only overrides it when the sheet has rows — leave the sheet alone unless the user asks).
- Keep going without stopping for confirmation unless the section is genuinely ambiguous (e.g. "Class I" with no letter) or a due date is unclear.
- Dates are Indian format (day/month/year). Current year 2026 unless the image clearly says otherwise.
- Do NOT create a PR — push straight to `main` (the user has standing approval for homework pushes).
