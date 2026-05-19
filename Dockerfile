# ============================================================
# Stage 1: deps — install all dependencies (including native)
# ============================================================
FROM node:22-alpine AS deps

# native modules (sharp, better-sqlite3) need build tools
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package.json package-lock.json* bun.lock* ./
COPY prisma ./prisma/

# Install with npm ci (uses package-lock.json when present)
# If only bun.lock is present the next line falls back gracefully
RUN npm install --frozen-lockfile 2>/dev/null || npm install

# Generate Prisma client after deps are installed
RUN npx prisma generate

# ============================================================
# Stage 2: builder — compile the Next.js app
# ============================================================
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copy installed node_modules and generated Prisma client
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy the rest of the source
COPY . .

# Build-time env vars that Next.js bakes into the bundle.
# NEXT_PUBLIC_* values must be present at build time.
# Override these as build args if you need different values per environment.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

# DATABASE_URL is required only at runtime (server-side Prisma),
# but next build may call getStaticProps/generateStaticParams that touch the DB.
# Pass a dummy value here; real value is injected at runtime via env_file.
ARG DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
ENV DATABASE_URL=$DATABASE_URL

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ============================================================
# Stage 3: runner — lean production image
# ============================================================
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Default port — overridden by PORT env var at runtime
ENV PORT=3003
ENV HOSTNAME="0.0.0.0"

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only what Next.js needs to serve the app.
# This project does NOT use output:"standalone", so we copy the full build.
COPY --from=builder --chown=nextjs:nodejs /app/public        ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next         ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules  ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json  ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma        ./prisma

USER nextjs

EXPOSE 3003

# Use dumb-init as PID 1 so signals are forwarded correctly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "--port", "3003"]
