# Railway: Discord Activity (realm dashboard)

Production path for **every player**: voice channel → **Activities** (rocket) → play the **web realm dashboard** at `/activity`. No localhost, no dev auth, no copying Discord IDs.

Optional: host the legacy Phaser client (`westeros-game-2d`) separately via `GAME_2D_URL` — not required for the Activity.

**Env checklist (copy-paste):** [env/railway-2d-activity.env.example](env/railway-2d-activity.env.example)

## Architecture

```text
Discord voice channel
        │
        ▼
┌───────────────────┐     HTTPS      ┌─────────────────┐
│ westeros-game-2d       │ ──────────────►│ westeros-bot API      │
│ (static dist/)    │   /v1/*        │ SERVICE=api     │
│ Railway service   │                │ same /data DB   │
└───────────────────┘                └────────┬────────┘
                                            │
                     ┌──────────────────────┼──────────────────────┐
                     ▼                      ▼                      ▼
              SERVICE=bot            SERVICE=web              westeros.db
```

| Piece | Repo | Railway |
|-------|------|---------|
| Bot + web + API | `js91tech/westeros-bot` | 3 services, shared `railway.toml`, `/data` volume on all three |
| Static 2D client | `js91tech/westeros-game-2d` | Separate service (`npm run build` → `npm run start`) |

---

## Checklist (do in order)

### 1. Discord Developer Portal

Same application as your bot.

| Step | Action |
|------|--------|
| 1 | **Activities** → enable **Embedded App** |
| 2 | **URL Mappings** → Root URL = **web `/activity`** (step 3), e.g. `https://westeros-web-production.up.railway.app/activity` (must be **Embedded App**, not “commands only”) |
| 3 | **Application ID** → `DISCORD_CLIENT_ID` on API + `VITE_DISCORD_CLIENT_ID` on 2D build |
| 4 | **OAuth2** → redirects: `http://127.0.0.1/callback` (Activity desktop — **required**), `https://127.0.0.1`, `https://<web>/oauth/callback` (browser login) |
| 5 | **(Optional Phaser client only)** URL Mappings → prefix **`/api`** → API host. The embedded dashboard uses **`POST /activity/auth`** on web, not `/api`. |

Tell players (any of these):

- **Voice channel → Activities** (rocket icon) → your game  
- **App launcher** (grid icon) → **Launch** (not the long command list)  
- Type **`/play2d`** in chat (opens the Activity if Embedded App + URL mapping → `/activity` are set)

---

### 2. westeros-bot — API service

Duplicate bot or web in Railway → rename **api** → same repo.

| Variable | Value |
|----------|--------|
| `SERVICE` | `api` |
| `DATABASE_PATH` | `/data/westeros.db` |
| `DISCORD_CLIENT_ID` | app id |
| `DISCORD_CLIENT_SECRET` | OAuth secret |
| `ACTIVITY_ORIGINS` | `https://<web-url>` if using Phaser client; dashboard Activity auth is same-origin on web |
| `ALLOW_DEV_AUTH` | `false` |

**Volume:** `/data` — **same volume** as bot and web.

**Start:** `npm run start:railway` (root `railway.toml`). If the service uses the repo **Dockerfile**, push latest `westeros-bot` (Dockerfile must include `apps/api`). **Healthcheck:** `/health` → `{"ok":true,"service":"westeros-api"}`.

Copy public URL → `https://<api>.up.railway.app` for `VITE_API_URL` when building 2D.

---

### 3. westeros-bot — bot + web

Unchanged. Shared `/data/westeros.db`:

| Service | `SERVICE` |
|---------|-----------|
| Bot | `bot` |
| Web | `web` |

On **web** (Activity + optional Phaser link):

| Variable | Value |
|----------|--------|
| `DISCORD_CLIENT_ID` | Application ID (same as bot) |
| `DISCORD_CLIENT_SECRET` | OAuth secret (`POST /activity/auth`) |
| `WEB_BASE_URL` | Public HTTPS URL (for OAuth redirect + Activity mapping) |
| `GAME_2D_URL` | *(optional)* `https://<2d-url>` — legacy Phaser client link on dashboard |
| `API_PUBLIC_URL` | *(optional)* `https://<api-url>` |

---

### 4. westeros-game-2d — static host

New Railway service from [westeros-game-2d](https://github.com/js91tech/westeros-game-2d).

| Setting | Value |
|---------|--------|
| Build | `npm install && npm run build` |
| Start | `npm run start` |
| Healthcheck | `/` |

**Build variables** (Railway → Variables; redeploy after any change):

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://<api>.up.railway.app` |
| `VITE_DISCORD_CLIENT_ID` | app id |

Do **not** set `VITE_DEV_DISCORD_ID` in production.

Copy 2D public HTTPS URL → Discord **URL Mappings** + API `ACTIVITY_ORIGINS`.

---

### 5. Verify

| Test | Expected |
|------|----------|
| `https://<api>/health` | `{"ok":true,"service":"westeros-api"}` |
| `https://<2d>/` | Phaser loading screen |
| Voice → Activity | Discord user auth, HUD shows stats |
| Bot `/profile` vs Activity | Same character (`westeros.db`) |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Activity shows slash commands, not game | Enable **Embedded App** + URL Mapping to 2D URL; redeploy 2D with `frame-ancestors` in `vite.config.js` |
| Activity blank / auth error | `ACTIVITY_ORIGINS` must exactly match 2D URL (scheme + host) |
| CORS in console | Add 2D origin to `ACTIVITY_ORIGINS` on API |
| Wrong/empty character | API must use **same shared volume** as bot/web — [RAILWAY-SHARED-DATABASE.md](RAILWAY-SHARED-DATABASE.md) |
| Bot and web different saves | Two volumes — merge to one volume at `/data` (link above) |
| `Failed to fetch` in Activity | Add URL Mapping `/api` → api host; keep **westeros-api** online; rebuild 2D after code update |
| `Unauthorized. Log in with Discord` | Redeploy **both** westeros-api + westeros-game-2d (latest); **westeros-api** `DISCORD_CLIENT_SECRET`; OAuth redirect `http://127.0.0.1/callback`; URL mapping `/api` → api host; check westeros-api logs for `[auth] 401` |
| `[westeros-db] No /data volume` on **westeros-api** | Attach volume at `/data` on westeros-api (or use `SERVICE=stack` on bot) — separate from login, but saves won’t persist |
| Build still hits localhost | Set `VITE_*` on 2D service and **redeploy** (baked into `dist/`) |
| 2D stuck **Deploying** forever | Railway healthcheck `/health` fails on static Vite — set health path to **`/`** or disable healthcheck |

---

## Related

- Bot/web Railway basics: [README.md](../README.md#deploy-on-railway-github-js91techwesteros-bot)
- API env template: [apps/api/.env.example](../apps/api/.env.example)
