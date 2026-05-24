# Discord mobile Activity checklist

## Player flow (iOS / Android)

1. Join a **voice channel** in your server.
2. Tap the **rocket** (Activities) icon.
3. Select **Westeros Realm** (your embedded app).
4. Play with on-screen **joystick** + **Interact** + HUD buttons.

Slash commands still work on mobile Discord separately; the Activity is the 2D game iframe.

## Hosting requirements

| Item | Requirement |
|------|-------------|
| Activity URL | **HTTPS** public URL (e.g. Railway static site) |
| API URL | **HTTPS** `apps/api` with same DB as bot |
| CORS | `ACTIVITY_ORIGINS=https://your-2d-domain.pages.dev` (exact origin) |
| OAuth | `DISCORD_CLIENT_ID` + `DISCORD_CLIENT_SECRET` on API service |

## Discord Developer Portal

1. Same application as bot → **Activities** → enable.
2. **URL Mappings** → root `/` → your hosted `westeros-game-2d` `dist/index.html`.
3. **OAuth2** redirect URLs include Activity proxy URLs Discord shows in the portal.
4. Under **Install** → ensure bot + activities scopes as needed.

## Railway services (recommended)

| Service | `SERVICE` | Notes |
|---------|-----------|--------|
| bot | `bot` | Slash commands |
| web | `web` | Optional dashboard |
| api | `api` | **Required for 2D** — port 3848 |
| 2d-static | — | Deploy `westeros-game-2d` `npm run build` → serve `dist/` |

All game services: shared volume `/data`, `DATABASE_PATH=/data/westeros.db`.

## Mobile UX (westeros-game-2d)

- Virtual joystick (bottom-left)
- Interact button (bottom-right)
- Tap interact zones on map
- 44px minimum touch targets on HUD
- `viewport-fit=cover` + safe-area padding for notched phones

## Troubleshooting mobile

| Issue | Fix |
|-------|-----|
| Black screen | Check HTTPS, browser console via remote debug |
| Auth failed | API must expose `/v1/auth/code`; secrets on API service |
| Can't save progress | API and bot must share same `DATABASE_PATH` |
| Joystick scrolls page | `touch-action: none` on canvas (included) |
| Activity not listed | Enable Activities in portal; app published to team |
