# Production multi-stage build (Phase 10). Two publishable targets:
#
#   docker build -t herd-scheduler .                      → the app (default:
#     slim runtime, non-root, no build tooling, runs `node server.js`)
#   docker build --target migrate -t herd-scheduler:migrate .
#     → the one-shot migration image (`prisma migrate deploy`), run as a
#     pre-deploy Job / init container against the same DATABASE_URL. Keeping
#     the CLI out of the app image is what keeps the app image slim.
#
# pnpm is provided via corepack, pinned by package.json's "packageManager".

# 1. Install dependencies (postinstall runs `prisma generate`).
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# 2. Build the standalone server.
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# 3. One-shot migration runner (NOT the default target). Reuses the deps
# stage's node_modules for the prisma CLI + engines; ships no app code. Runs
# as the unprivileged `node` user the base image provides.
FROM node:22-alpine AS migrate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
USER node
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# 4. Slim runtime image (default target). Non-root, no package manager use,
# nothing but the standalone server + static assets + the Prisma client.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Unprivileged runtime user — uid/gid 1001 to avoid colliding with the base
# image's `node` (1000) and to match the standard Next.js deployment example.
# Also strip the package managers the base image ships: the runtime needs only
# the `node` binary, and an image without npm/corepack can't fetch tooling.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Standalone output bundles only the files the server needs.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma's generated client + query engine, which Next's file tracing may not
# pick up — copied so runtime queries work.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
