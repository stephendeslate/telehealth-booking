FROM node:22-slim AS base
RUN npm i -g pnpm@9
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY prisma/ prisma/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY . .
RUN pnpm --filter @medconnect/shared build
RUN pnpm --filter @medconnect/api build
RUN pnpm --filter @medconnect/api --prod deploy /prod

# Production
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /prod ./
COPY --from=build /app/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/main.js"]
