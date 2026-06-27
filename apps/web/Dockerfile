# NagarikAI Web — Cloud Run Dockerfile
# Multi-stage build: install + build in one stage, then copy only the
# standalone output to a small runtime stage. Final image ~150 MB.

# ─── 1. Dependencies ───────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ─── 2. Build ──────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* is baked into the client bundle at build time. The defaults
# below are the live production values; override per-arg with `docker build
# --build-arg NEXT_PUBLIC_*=...` (or pass via Cloud Build substitutions).
ARG NEXT_PUBLIC_API_URL=https://api.nagarikai.xyz
ARG NEXT_PUBLIC_MAPBOX_TOKEN=""
ARG NEXT_PUBLIC_CITY_CENTER_LAT=12.9716
ARG NEXT_PUBLIC_CITY_CENTER_LNG=77.5946
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_MAPBOX_TOKEN=${NEXT_PUBLIC_MAPBOX_TOKEN} \
    NEXT_PUBLIC_CITY_CENTER_LAT=${NEXT_PUBLIC_CITY_CENTER_LAT} \
    NEXT_PUBLIC_CITY_CENTER_LNG=${NEXT_PUBLIC_CITY_CENTER_LNG} \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── 3. Runtime ────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080

# Non-root user, just in case.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080
# Cloud Run sets PORT; node server.js honours it via process.env.
CMD ["node", "server.js"]
