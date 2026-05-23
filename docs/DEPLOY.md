# Deploy Westeros Bot (single Railway service)

## One service only

Use **one** Railway service with `SERVICE=stack`. Do not split bot/web/api unless you accept separate databases.

1. New project → deploy from `westeros-bot` repo
2. **Start command:** `npm run start:railway`
3. **Volume:** `/data`
4. **Variables:**

```
SERVICE=stack
DATABASE_PATH=/data/westeros.db
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
SESSION_SECRET=...
WEB_BASE_URL=https://YOUR_APP.up.railway.app
ALLOW_DEV_AUTH=false
ACTIVITY_ORIGINS=https://YOUR_APP.up.railway.app
```

5. Discord Developer Portal → OAuth2 redirect: `https://YOUR_APP.up.railway.app/oauth/callback`

## Healthcheck

Path: `/health` on the public `PORT` (web).

## What runs in the container

- `@westeros/discord-bot` — background
- `@westeros/web` — public HTTP (`PORT`)
- `@westeros/api` — localhost `API_PORT` (default 3848), proxied at `/api/*`

Game tick scheduler runs **once** (web process only in stack mode).
