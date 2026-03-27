FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Build frontend
FROM base AS builder
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
ENV JELLY_RUNTIME=local
RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV JELLY_RUNTIME=local
ENV JELLY_DATA_DIR=/app/data
ENV PORT=3000

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server and worker source
COPY --from=builder /app/server ./server
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig*.json ./

# Create data directories
RUN mkdir -p /app/data/storage /app/data/actors /app/data/deployments

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["bun", "server/index.ts"]
