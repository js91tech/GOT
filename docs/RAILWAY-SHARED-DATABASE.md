# Railway: one save file (bot + web + API)

If `/profile` on the bot and your **website** show different characters, they are using **different** `westeros.db` files.

## Why (Railway limitation)

**Railway does not let one volume attach to multiple services.**

Your canvas is correct:

| Volume | Service |
|--------|---------|
| `@westeros/discord-bot-volume` | bot only |
| `@westeros/web-volume` | web only |
| `jjk-api-volume` | api only |

Same mount path `/data` on each, but **three separate disks** → three saves.

You are **not** doing anything wrong — the platform works this way.

---

## Stuck on “Deploying” in Railway

Your **runtime logs can look healthy** (bot logged in, web on port 8080) while the dashboard still says **Deploying**. Railway is waiting for its **health check** on `PORT` + `/health` (see `railway.toml`).

| Service | What must answer `/health` on `PORT` |
|---------|--------------------------------------|
| `SERVICE=botweb` or `web` | Web app (`apps/web`) — should pass within ~30s |
| `SERVICE=api` | API (`/health` JSON) |
| `SERVICE=bot` only | No web — use latest `railway-service-start.js` (adds a tiny `/health` listener) **or** disable health check in Railway → Settings |
| **westeros-game-2d** (separate repo) | Vite preview has **no** `/health` — in Railway set **Healthcheck Path** to `/` or **None** |

Other causes:

- **Queued deploys** — cancel old deployments; only one active deploy per service.
- **Build vs deploy** — “Building” is npm/Docker; “Deploying” is after the container starts.
- **Wrong service** — remove duplicate `@westeros/web` if you use `SERVICE=botweb` on the bot service.

---

## Fix A — Bot + web in **one** service (recommended)

Run **Discord bot and website together** on the service that already has the save you want (usually **bot**).

### Steps

1. Open **`@westeros/discord-bot`** service → **Variables**:
   ```env
   SERVICE=botweb
   DATABASE_PATH=/data/westeros.db
   ```
   (Keep `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `WEB_BASE_URL`, `SESSION_SECRET`, `DISCORD_CLIENT_SECRET`, etc.)

2. Set **`WEB_BASE_URL`** to this service’s public URL (the bot service domain), e.g.:
   ```env
   WEB_BASE_URL=https://your-bot-service.up.railway.app
   ```

3. **Redeploy** the bot service.

4. **Remove** the separate **`@westeros/web`** service (see below — Railway has no “pause”, only remove).

5. Open the **bot service URL** in a browser — that is your dashboard now.

6. Discord OAuth redirect must use that same URL:
   ```text
   https://your-bot-service.up.railway.app/oauth/callback
   ```

Bot and web now share `@westeros/discord-bot-volume` automatically.

---

## Will 2D use the same save as bot?

**Not automatically.** `westeros-game-2d` only talks to **`jjk-api`**, which reads `westeros.db` from **whatever volume is on the api service** (`jjk-api-volume` today).

| Setup | Bot + web | 2D game |
|--------|-----------|---------|
| `SERVICE=botweb` only | Same save on bot volume | Still **api** volume (can differ) |
| **`SERVICE=stack`** on bot | Same save | Same save (api in same container) |

For one save everywhere: use **Fix B** below and point `VITE_API_URL` at your stack’s API URL.

---

## Fix B — Bot + web + API in **one** service (2D + one save)

If you also want **2D and bot** on the same `westeros.db` without copying files:

1. Use the **bot** service (or rename it `jjk-stack`).
2. Variables:
   ```env
   SERVICE=stack
   DATABASE_PATH=/data/westeros.db
   API_PORT=3848
   ```
   Plus all bot/web/api secrets.
3. **Networking:** Railway’s public `PORT` goes to the **web** UI. Add a **TCP proxy** (or second public URL) on port **3848** for the API so `VITE_API_URL` can reach it.
4. **Delete** separate `@westeros/web` and `jjk-api` services after this works.
5. Redeploy.

This is more setup; **Fix A** plus a separate API is simpler if 2D progress can stay on the API volume until you migrate DB.

---

## Fix C — PostgreSQL (later, best long-term)

All services connect to one **Railway Postgres** instead of SQLite files. Not implemented in this repo yet; would need a schema migration.

---

## Verify one save

Logs should show the same file size on processes in the **same** service:

```text
[westeros-db] service=bot path=/data/westeros.db exists=true size=123456
[westeros-db] service=web path=/data/westeros.db exists=true size=123456
```

Test: change coins on the site → `/profile` in Discord matches.

---

## Merge two existing saves

1. Pick the volume with the character you want to keep (often **bot**).
2. Download `/data/westeros.db` from that volume (Railway volume UI / CLI).
3. For other services you still run separately: upload that file to their volume (only if you must keep multiple services).
4. With **Fix A**, you only need the bot volume.

---

## Remove the old `@westeros/web` service (not pause)

Railway does not have a pause button. To stop paying for the extra web app:

1. Project canvas → click **`@westeros/web`**
2. **Settings** → scroll to **Danger** → **Remove service from project**  
   (or ⋮ menu on the service → **Remove**)
3. Confirm

Your site lives on the **bot** URL when using `SERVICE=botweb`.

---

## Local dev

One file: `DATABASE_PATH=./data/westeros.db` for both `npm run start:bot` and `npm run start:web`.
