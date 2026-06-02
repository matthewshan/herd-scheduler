# Minimal multi-stage build. Hardening (non-root, slimming) is Phase 8 — this
# just proves the portable standalone path and a reliable migration step.
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

# 3. Slim runtime image.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Standalone output bundles only the files the server needs.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma's generated client + query engine, which Next's file tracing may not
# pick up — copied so runtime queries work.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
