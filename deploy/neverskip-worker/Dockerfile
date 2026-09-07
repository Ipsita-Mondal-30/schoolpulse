# Persistent Playwright worker for NeverSkip sync (NOT deployed to Vercel).
# Keep the Chromium profile on a volume so the session survives restarts.
FROM mcr.microsoft.com/playwright:v1.58.0-jammy

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV NEVERSKIP_HEADLESS=true
ENV NEVERSKIP_PROFILE_DIR=/data/neverskip-profile
ENV NEVERSKIP_SYNC_INTERVAL_HOURS=4
ENV NEVERSKIP_WORKER_RUN_ON_START=true

VOLUME ["/data/neverskip-profile"]

CMD ["npm", "run", "worker:neverskip"]
