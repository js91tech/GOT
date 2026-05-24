# Westeros Bot

Realm strategy MUD inspired by feudal fantasy — **Discord slash commands**, **web dashboard**, and **interactive territory map**. One deploy runs everything.

## Quick start (local)

```bash
cd westeros-bot
cp .env.example .env
# Fill DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SESSION_SECRET

npm install
npm run db:init
npm start
```

- Web: http://localhost:3847 (Discord OAuth)
- Map: http://localhost:3847/map
- API (internal): http://127.0.0.1:3848 — proxied at http://localhost:3847/api

`npm start` runs **`SERVICE=stack`**: Discord bot + web + API in one process group, one SQLite file.

## New commands

| Command | Purpose |
|---------|---------|
| `/house` | List or join a Great House |
| `/guild` | Found/join guild, treasury |
| `/realm` | Region list + link to web map |
| `/war` | Declare siege, reinforce, status |

Plus the full realm RPG core (`/train`, `/profile`, `/attack`, …).

## Railway (one service)

| Variable | Value |
|----------|--------|
| `SERVICE` | `stack` (default) |
| `DATABASE_PATH` | `/data/westeros.db` |
| Volume | mount `/data` |
| Start | `npm run start:railway` |
| `WEB_BASE_URL` | `https://your-app.up.railway.app` |

Discord OAuth redirect: `{WEB_BASE_URL}/oauth/callback`

For Discord Activity later: map `/` and `/api` to the **same** public URL.

## Repo layout

```
packages/game-core   — rules, SQLite, factions/guilds/territories
apps/discord-bot     — slash commands
apps/web             — OAuth, dashboard, /map
apps/api             — REST for Activity / map API
```

## Data

- `packages/game-core/data/factions.json` — Great Houses
- `packages/game-core/data/territories.json` — map regions (12 MVP)

Territories generate resources into **guild treasury** on the global tick when a guild holds land.
