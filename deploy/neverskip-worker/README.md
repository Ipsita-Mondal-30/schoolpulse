# NeverSkip external worker

This directory packages the **Playwright NeverSkip sync worker** that must run
**outside Vercel**. Vercel Hobby cannot schedule jobs more than once per day,
and serverless functions cannot host a persistent browser profile.

See the root [README.md](../../README.md) for full production steps.
