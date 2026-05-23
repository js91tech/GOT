FROM node:20-alpine

# better-sqlite3 native build
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/game-core/package.json ./packages/game-core/
COPY apps/discord-bot/package.json ./apps/discord-bot/
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN npm install --omit=dev

COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

RUN chmod +x scripts/railway-start.sh

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/jjk.db
ENV SERVICE=web

EXPOSE 3847

CMD ["./scripts/railway-start.sh"]
