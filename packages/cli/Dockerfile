# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Enable corepack and pnpm
RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

# Copy manifests first for better caching
COPY package.json pnpm-lock.yaml tsconfig.json tsup.config.ts ./
COPY src ./src

# Install and build
RUN pnpm install --frozen-lockfile \
    && pnpm build \
    && pnpm prune --prod

# --- Runtime stage ---
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /work

# App runtime files
COPY --from=build /app/dist /usr/local/lib/opd/dist
COPY --from=build /app/package.json /usr/local/lib/opd/package.json
COPY --from=build /app/node_modules /usr/local/lib/opd/node_modules

ENTRYPOINT ["node", "/usr/local/lib/opd/dist/index.js"]
CMD ["--help"]
