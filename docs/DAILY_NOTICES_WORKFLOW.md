# SchoolPulse — Daily Notices Runbook

A once-a-day routine to pull the school's **Daily Notice** board from the Neverskip
parent portal into the SchoolPulse app, then commit and deploy. Best run from the
**Claude Code CLI** on your Mac (no browser/bridge restrictions, and it can `git push`).

---

## What this activity is

Every day, once:

1. Look at the Neverskip **Daily Notice** board (`parent.neverskip.com/default/dailynotice`).
2. Capture any **new** notices — date, time, class sections, and message.
3. Add them to `data/notices.json` (newest first, de-duplicated).
4. Bump the `lastSynced` date.
5. `npm run build` to confirm it compiles.
6. Commit and `git push origin main` → the site auto-deploys, and the new notices
   show up on the **Notices** tab (`/notices`).

The heavy lifting is codified in the `/update-notices` slash command, so day-to-day
you only run one command.

---

## One-time setup

Do this once from your Mac Terminal:

```bash
cd ~/schoolpulse

# 1. Get the Notices tab onto main (it's currently on a feature branch)
git checkout main
git merge feature/notices-tab        # fast-forwards main to include the tab
git push origin main

# 2. Commit the /update-notices slash command (already written into the repo)
git add .claude/commands/update-notices.md
git commit -m "Add /update-notices slash command for daily notice syncing"
git push origin main

# 3. Housekeeping from the earlier cloud session (safe to delete)
rm -rf _git_stale_to_delete
```

`npm install` once too, if you haven't, so `npm run build` works during the daily run.

---

## The daily command

Open Claude Code in the repo and run the slash command:

```bash
cd ~/schoolpulse
claude
```

then inside Claude Code:

```
/update-notices
```

**Login note:** the portal login needs your password + a CAPTCHA, which only you can
enter. Two easy ways to feed Claude the notices:

- **Screenshot (simplest):** open the notice board yourself, take a screenshot,
  drag it into the Claude Code prompt, then type `/update-notices`. No automation needed.
- **Browser:** if you use Claude-in-Chrome, `/update-notices` will open the board;
  when it asks, log in yourself (mobile `9880321906` + your password + CAPTCHA) and
  it reads the page once you're in.

That's it — Claude extracts new notices, de-dupes against what's already stored,
builds, commits, and pushes to `main`.

---

## What Claude does each run (the `/update-notices` steps)

1. Reads the notice board (from your screenshot or the browser).
2. For each notice, captures `date` (YYYY-MM-DD), `time` (24h HH:MM),
   `classes` (e.g. `["I-A","I-B"]`), a short `summary`, and the full `message`;
   `id` = `date-HHMM` (e.g. `2026-07-20-1539`).
3. Opens `data/notices.json`, skips any notice that already exists, and prepends the
   new ones (newest first).
4. Updates `lastSynced` to today.
5. Optionally adds any newly uploaded worksheets/answer keys to the Content Library
   (`data/info/class-diary.json`) if you provide the PDF links.
6. Runs `npm run build` to verify.
7. Commits (`Sync <Mon DD> daily notices (N new)`) and pushes to `main`.
8. Summarizes what was added and what was skipped as a duplicate.

---

## Data shape (`data/notices.json`)

```json
{
  "source": "Neverskip Parent Portal — Daily Notice (BGS National Public School)",
  "sourceUrl": "https://parent.neverskip.com/default/dailynotice",
  "lastSynced": "2026-07-21",
  "notices": [
    {
      "id": "2026-07-20-1539",
      "date": "2026-07-20",
      "time": "15:39",
      "classes": ["I-A", "I-B", "I-G", "I-I"],
      "summary": "Send the English textbook in the school bag tomorrow",
      "message": "Jai Sri Gurudev. Namaste Dear Parents and Students, Please send the English textbook in the bag tomorrow to continue with the further unit. It will be sent back in the bag. Thank you."
    }
  ]
}
```

The Notices tab derives the subject tag, "Action needed" flag, due-date pill, and
Content-Library link automatically from the text — you only ever fill the fields above.

---

## Notes

- **Never store the portal password** in the repo or in a command. You always type it
  (and the CAPTCHA) yourself.
- Dates are Indian format (day/month/year); the current year is 2026.
- Pushes go straight to `main` (same standing approval as `/add-homework`); the app
  auto-deploys. Switch to a PR flow only if you prefer review.
- Optional: add a daily reminder (e.g. a macOS Calendar alert or `launchd` job) that
  just reminds *you* to run `/update-notices` — it can't be fully unattended because
  of the login CAPTCHA.
