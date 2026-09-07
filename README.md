This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
Bit 0

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## NeverSkip local sync (browser session)

SchoolPulse can import homework and notices from the NeverSkip Parent Portal using a **normal authenticated browser session** (Playwright). CAPTCHA and login are never bypassed.

### First time — authenticate once

```bash
npm run neverskip:login
```

1. Playwright opens NeverSkip in a **headed** browser.
2. Log in normally in the portal (complete CAPTCHA if shown).
3. When authentication succeeds, the session is saved under `.playwright-profile/` (or `NEVERSKIP_PROFILE_DIR`).
4. The login process exits cleanly.

### Later — headless sync

```bash
DATABASE_URL="file:/absolute/path/to/schoolpulse/prisma/dev.db" npm run sync:neverskip:browser
```

This reuses the persisted Playwright profile, opens NeverSkip headlessly, captures homework + notice API responses (including homework pagination), then runs the existing normalize → dedupe → Prisma pipeline.

If the session has expired you will see:

```text
[SchoolPulse] NeverSkip session expired
[SchoolPulse] Manual re-authentication required
```

Then run `npm run neverskip:login` again. Do not commit `.playwright-profile/` — it contains sensitive session data and is listed in `.gitignore`.

Optional token-based sync (`npm run sync:neverskip` + `NEVERSKIP_TOKEN`) remains available as a fallback adapter and is separate from the browser profile workflow.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out the [Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
