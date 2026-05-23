# Simple setup (work backwards)

Use **one Railway service** instead of bot + web + api + 2d scattered across four deploys.

## Phase 1 — Dashboard + bot (one service)

### Railway

1. Keep only **`@westeros/discord-bot`** (delete separate `@westeros/web` and `jjk-api` if you still have them).
2. **Volume** on that service: mount at `/data`.
3. **Variables:**

```env
SERVICE=stack
DATABASE_PATH=/data/westeros.db
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
SESSION_SECRET=...
WEB_BASE_URL=https://YOUR-SERVICE.up.railway.app
API_PORT=3848
ALLOW_DEV_AUTH=false
ACTIVITY_ORIGINS=https://YOUR-2D.up.railway.app
```

4. **Networking** → turn on **Public domain** → copy URL into `WEB_BASE_URL`.
5. **Start command:** `npm run start:railway` (from repo root `railway.toml`).
6. **Redeploy** when GitHub is healthy (or manual Redeploy).

### Verify (in browser)

| URL | Expected |
|-----|----------|
| `https://YOUR-SERVICE.up.railway.app/health` | `{"ok":true,"service":"web"}` |
| `https://YOUR-SERVICE.up.railway.app/api/health` | `{"ok":true,"service":"jjk-api"}` |
| `https://YOUR-SERVICE.up.railway.app/` | Home / login |

### Discord Developer Portal

**OAuth2 → Redirects:**

```text
https://YOUR-SERVICE.up.railway.app/oauth/callback
http://127.0.0.1/callback
```

---

## Phase 2 — 2D Activity (optional)

Keep **westeros-game-2d** as its own Railway service.

**westeros-game-2d variables (build):**

```env
VITE_DISCORD_CLIENT_ID=<same app id>
```

Do **not** set `VITE_DEV_DISCORD_ID` on Railway.

**Discord → Activities → URL Mappings:**

| Prefix | Target |
|--------|--------|
| `/` | `YOUR-2D.up.railway.app` |
| `/api` | `YOUR-SERVICE.up.railway.app` |

The `/api` mapping hits your **stack** service; web proxies to the API inside the same container (one `westeros.db`).

Redeploy **westeros-game-2d** after any client change.

---

## Phase 3 — Local test (before Railway)

From repo root:

```bash
npm install
cp .env.example .env
# fill DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, SESSION_SECRET
SERVICE=stack npm run start:railway
```

Open `http://localhost:3847` (or whatever `PORT` is).

---

## If something fails

| Symptom | Check |
|---------|--------|
| Railway “train has not arrived” | Public domain on **stack** service; deploy **Active** |
| `/health` works, `/api/health` 502 | Logs for `api` process; `API_PORT=3848` |
| Dashboard login fails | `WEB_BASE_URL` matches public URL; OAuth redirect in Discord |
| Activity Unauthorized | Redeploy 2D + stack; no `VITE_DEV_DISCORD_ID`; `/api` mapping → **stack** domain |

---

## What `SERVICE=stack` does

```text
One container
├── Discord bot
├── Web UI  → Railway PORT (public)
└── Game API → 127.0.0.1:3848 (internal)
         ↑
    Web proxies /api/* here
```

One volume → one save file for bot, dashboard, and Activity.
