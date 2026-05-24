# Bootstrap audit (completed)

## Zip source

`c:\Users\ludal\Downloads\westeros-bot.zip` was extracted to [`zip-import/westeros-bot/`](zip-import/westeros-bot/).

## Original stack (preserved in zip-import)

| Item | Detail |
|------|--------|
| Runtime | Python 3 + discord.py |
| DB | PostgreSQL via asyncpg (Railway-oriented) |
| Entry | `bot.py` with prefix commands |
| Cogs | profile, combat, explore, shop, mine, forge, clan, housing, heal, daily, npc, leaderboard, admin |
| Data | `data/areas.json`, `materials.json`, `recipes.json`, `npcs.json`, `domains.json` |

## This repo (new implementation per plan)

| Item | Detail |
|------|--------|
| Runtime | Node 18+ monorepo |
| Packages | `@westeros/game-core`, `@westeros/discord-bot`, `@westeros/web` |
| DB | SQLite (`data/westeros.db`) — set `DATABASE_URL` / `DATABASE_PATH` for custom path |
| Clients | Discord slash commands + web UI (Discord OAuth2) |

Westeros-style systems implemented in `game-core`:

- **MVP:** CE regen, gym, missions, PvP (attack/mug/rob), hospital/jail, shop, bank, jobs, wheel, lounge, daily login
- **Phase 2:** education, clans, estates, item/gold markets, forge, commodities
- **Phase 3:** delve (mining), grab bags, leaderboards, worlds, admin
- **Phase 4 (SoL parity):** worker stats, gyms, equip slots, companies, drugs, explore/NPCs from `data/areas.json`, forge recipes

## Merging old Python progress

Player data is **not** auto-migrated (Postgres schema differs). To reuse content:

1. Port balance from `zip-import/westeros-bot/constants.py` into `packages/game-core/src/balance.json`
2. Port areas/NPCs from `zip-import/westeros-bot/data/*.json` into future explore module
3. Run the Python bot from `zip-import/westeros-bot/` if you still need prefix commands on Railway

## Commands mapping (Python → Node slash)

| Python cog | Node |
|------------|------|
| profile | `/profile` |
| combat | `/attack` `/mug` `/rob` |
| explore | `/crime` `/delve` `/world` |
| shop | `/shop` |
| mine | `/delve` |
| forge | `/forge` |
| clan | `/clan` |
| housing | `/estate` |
| heal | `/use` reversal_kit, infirmary timers |
| daily | login streak + `/wheel` |
| leaderboard | `/leaderboard` |
