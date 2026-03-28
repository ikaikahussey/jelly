FROM node:22-slim AS base
WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm rebuild

# Build frontend (needs all deps including devDependencies)
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild
COPY . .
ENV JELLY_RUNTIME=local
RUN npx vite build

# Production image
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV JELLY_RUNTIME=local
ENV JELLY_DATA_DIR=/app/data
ENV PORT=3000

# Copy production dependencies (includes pre-built native modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy server and worker source (tsx compiles TS at runtime)
COPY --from=builder /app/server ./server
COPY --from=builder /app/worker ./worker
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig*.json ./

# Need tsx in production for TypeScript execution + ESM loader hooks
RUN npm install tsx

# Create data directories
RUN mkdir -p /app/data/storage /app/data/actors/agents /app/data/deployments

EXPOSE 3000

CMD ["npx", "tsx", "--tsconfig", "tsconfig.server.json", "--import", "./server/register.ts", "server/index.ts"]
