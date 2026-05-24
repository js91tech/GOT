FROM node:20-alpine

# better-sqlite3 native build
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/game-core/package.json ./packages/game-core/
COPY apps/discord-bot/package.json ./apps/discord-bot/
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN npm ci --omit=dev

COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
COPY railway.toml ./

RUN npm run generate:realm-map || true

ENV NODE_ENV=production
ENV SERVICE=stack
ENV DATABASE_PATH=/data/westeros.db
ENV API_PORT=3848

EXPOSE 3847

CMD ["sh", "-c", "npm run db:init -w @westeros/game-core || true && npm run start:railway"]
