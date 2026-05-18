# syntax=docker/dockerfile:1.7

# ─── base ─────────────────────────────────────────────────────────────────────
# bookworm-slim is glibc-based, which matches better-sqlite3's prebuilt binary
# for linux-x64. (Alpine = musl, which would force a source compile.)
FROM node:20-bookworm-slim AS base
WORKDIR /app

# ─── deps: install with dev deps so the build can run ────────────────────────
FROM base AS deps
# python3/make/g++ are only needed if better-sqlite3's prebuild fetch fails and
# npm has to compile from source. Keeping them in this stage only — they don't
# end up in the runtime image.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ─── builder: produce .next/standalone ───────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── runner: minimal production image ────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# gosu lets the entrypoint chown the mounted volume as root, then drop to a
# non-root user before exec'ing the Node server.
RUN apt-get update && apt-get install -y --no-install-recommends gosu \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone server + traced deps (includes the better-sqlite3 native binary).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Uploads live on the Fly volume. Symlink the URL path so Next's built-in
# /uploads route resolves to /data/uploads at runtime. The target doesn't
# exist at build time; that's fine — the symlink resolves when the volume
# mounts.
RUN rm -rf public/uploads && ln -sfn /data/uploads public/uploads

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
