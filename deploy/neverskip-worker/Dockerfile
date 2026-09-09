# Persistent Playwright worker for NeverSkip sync (NOT deployed to Vercel).
# Keep the Chromium profile on a host volume so the session survives restarts.
#
# Production path: one-shot `npm run sync:neverskip:browser` via host cron.
# Do NOT use GitHub-hosted Actions as the production browser worker.
FROM mcr.microsoft.com/playwright:v1.58.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV NEVERSKIP_HEADLESS=true
ENV NEVERSKIP_PROFILE_DIR=/data/neverskip-profile

# Profile lives under /data on a persistent volume (never commit the profile).
VOLUME ["/data"]

# Default: one-shot sync that exits when finished (for host cron / compose run).
CMD ["npm", "run", "sync:neverskip:browser"]
