import { getDb } from './db.js';
import { getOrCreatePlayer } from './player.js';
import { getPlayerGuild, isGuildOfficer } from './guild.js';
import { listFactions } from './faction.js';
import { resourceIcon, resourceLabel } from './got-theme.js';
import { getEffectiveStats } from './stats.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SIEGE_TARGET = 100;
const SIEGE_HOURS = 24;

function parseNeighbors(row) {
  try {
    return JSON.parse(row.neighbors_json || '[]');
  } catch {
    return [];
  }
}

function getControl(territoryId) {
  return getDb().prepare('SELECT * FROM territory_control WHERE territory_id = ?').get(territoryId);
}

function ownerLabel(control) {
  if (!control) return 'Unclaimed';
  const db = getDb();
  if (control.owner_type === 'faction') {
    const f = db.prepare('SELECT name FROM factions WHERE id = ?').get(control.owner_id);
    return f ? (f.name.startsWith('House ') ? f.name : `House ${f.name}`) : control.owner_id;
  }
  if (control.owner_type === 'guild') {
    const g = db.prepare('SELECT tag, name FROM guilds WHERE id = ?').get(control.owner_id);
    return g ? `[${g.tag}] ${g.name}` : `Guild #${control.owner_id}`;
  }
  return 'Unknown';
}

export function listTerritoriesWithControl() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM territories ORDER BY name').all();
  return rows.map((t) => {
    const control = getControl(t.id);
    const siege = db
      .prepare(
        `SELECT * FROM territory_sieges WHERE territory_id = ? AND status = 'active' LIMIT 1`
      )
      .get(t.id);
    return {
      ...t,
      neighbors: parseNeighbors(t),
      control: control || null,
      owner_label: ownerLabel(control),
      active_siege: siege || null
    };
  });
}

export function getTerritoryDetail(territoryId, discordId, username) {
  const db = getDb();
  const t = db.prepare('SELECT * FROM territories WHERE id = ?').get(territoryId);
  if (!t) return { ok: false, message: 'Unknown territory.' };
  const player = discordId ? getOrCreatePlayer(discordId, username) : null;
  const control = getControl(territoryId);
  const siege = db
    .prepare(
      `SELECT * FROM territory_sieges WHERE territory_id = ? AND status = 'active' LIMIT 1`
    )
    .get(territoryId);
  return {
    ok: true,
    territory: {
      ...t,
      neighbors: parseNeighbors(t),
      control,
      owner_label: ownerLabel(control),
      active_siege: siege
    },
    player
  };
}

export function realmSummary(baseUrl) {
  const territories = listTerritoriesWithControl();
  const lines = territories.map(
    (t) => `**${t.display_name}** — ${t.resource_type} — ${t.owner_label}`
  );
  const mapUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/map` : null;
  return {
    ok: true,
    message: lines.join('\n'),
    mapUrl,
    territories
  };
}

function sharesBorder(territoryId, otherId) {
  const t = getDb().prepare('SELECT neighbors_json FROM territories WHERE id = ?').get(territoryId);
  if (!t) return false;
  return parseNeighbors(t).includes(otherId);
}

function guildControlsTerritory(guildId, territoryId) {
  const c = getControl(territoryId);
  return c && c.owner_type === 'guild' && String(c.owner_id) === String(guildId);
}

export function declareWar(discordId, username, territoryId) {
  const player = getOrCreatePlayer(discordId, username);
  if (!player.guild_id) return { ok: false, message: 'Join a guild to declare war.' };
  if (!isGuildOfficer(player)) {
    return { ok: false, message: 'Only guild leaders/officers can declare war.' };
  }
  const db = getDb();
  const target = db.prepare('SELECT * FROM territories WHERE id = ?').get(territoryId);
  if (!target) return { ok: false, message: 'Unknown territory.' };

  const control = getControl(territoryId);
  if (control && control.owner_type === 'guild' && String(control.owner_id) === String(player.guild_id)) {
    return { ok: false, message: 'Your guild already holds this land.' };
  }

  const guildLands = db
    .prepare(
      `SELECT territory_id FROM territory_control WHERE owner_type = 'guild' AND owner_id = ?`
    )
    .all(player.guild_id);
  const hasAdjacent =
    guildLands.length === 0 ||
    guildLands.some((row) => sharesBorder(row.territory_id, territoryId));
  if (!hasAdjacent && guildLands.length > 0) {
    return { ok: false, message: 'You can only siege land adjacent to territory your guild holds.' };
  }

  const existing = db
    .prepare(
      `SELECT id FROM territory_sieges WHERE territory_id = ? AND status = 'active'`
    )
    .get(territoryId);
  if (existing) return { ok: false, message: 'A siege is already underway here.' };

  const defenderType = control?.owner_type || 'faction';
  const defenderId = control?.owner_id || target.default_faction_id || 'neutral';
  const endsAt = new Date(Date.now() + SIEGE_HOURS * 3600000).toISOString();

  db.prepare(
    `INSERT INTO territory_sieges
     (territory_id, attacker_guild_id, defender_type, defender_id, progress, status, ends_at)
     VALUES (?, ?, ?, ?, 0, 'active', ?)`
  ).run(territoryId, player.guild_id, defenderType, defenderId, endsAt);

  return {
    ok: true,
    message: `War declared on ${target.display_name}! Rally your guild to /war contribute.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function contributeSiege(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  if (!player.guild_id) return { ok: false, message: 'Join a guild first.' };
  const db = getDb();
  const siege = db
    .prepare(
      `SELECT * FROM territory_sieges
       WHERE attacker_guild_id = ? AND status = 'active'
       ORDER BY id DESC LIMIT 1`
    )
    .get(player.guild_id);
  if (!siege) return { ok: false, message: 'Your guild has no active siege.' };

  const stats = getEffectiveStats(player, db);
  const power = Math.floor((stats.strength + stats.defense) / 4 + 5 + Math.random() * 10);
  const newProgress = Math.min(SIEGE_TARGET, siege.progress + power);
  db.prepare('UPDATE territory_sieges SET progress = ? WHERE id = ?').run(newProgress, siege.id);

  if (newProgress >= SIEGE_TARGET) {
    resolveSiege(siege.id);
    const t = db.prepare('SELECT display_name FROM territories WHERE id = ?').get(siege.territory_id);
    return {
      ok: true,
      message: `Victory! ${t?.display_name || 'Territory'} captured! (+${power} final blow)`,
      player: getOrCreatePlayer(discordId, username)
    };
  }

  return {
    ok: true,
    message: `You reinforced the siege (+${power}). Progress: ${newProgress}/${SIEGE_TARGET}.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function warStatus(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  if (!player.guild_id) return { ok: false, message: 'Not in a guild.' };
  const siege = db
    .prepare(
      `SELECT s.*, t.display_name
       FROM territory_sieges s
       JOIN territories t ON t.id = s.territory_id
       WHERE s.attacker_guild_id = ? AND s.status = 'active'
       ORDER BY s.id DESC LIMIT 1`
    )
    .get(player.guild_id);
  if (!siege) return { ok: true, message: 'No active siege.' };
  return {
    ok: true,
    message: `Siege on **${siege.display_name}**: ${siege.progress}/${SIEGE_TARGET} (ends ${siege.ends_at})`
  };
}

export function resolveSiege(siegeId) {
  const db = getDb();
  const siege = db.prepare('SELECT * FROM territory_sieges WHERE id = ?').get(siegeId);
  if (!siege || siege.status !== 'active') return;
  db.prepare("UPDATE territory_sieges SET status = 'won' WHERE id = ?").run(siegeId);
  const garrison = 50;
  db.prepare(
    `INSERT INTO territory_control (territory_id, owner_type, owner_id, garrison_power, captured_at, tax_rate)
     VALUES (?, 'guild', ?, ?, datetime('now'), 0.1)
     ON CONFLICT(territory_id) DO UPDATE SET
       owner_type = 'guild',
       owner_id = excluded.owner_id,
       garrison_power = excluded.garrison_power,
       captured_at = datetime('now')`
  ).run(siege.territory_id, siege.attacker_guild_id, garrison);
}

export function processSiegesAndYields() {
  const db = getDb();
  const now = Date.now();
  const expired = db
    .prepare(`SELECT * FROM territory_sieges WHERE status = 'active' AND ends_at < datetime('now')`)
    .all();
  for (const s of expired) {
    if (s.progress >= SIEGE_TARGET * 0.5) resolveSiege(s.id);
    else db.prepare("UPDATE territory_sieges SET status = 'failed' WHERE id = ?").run(s.id);
  }

  const controls = db.prepare('SELECT * FROM territory_control WHERE owner_type = ?').all('guild');
  for (const c of controls) {
    const t = db.prepare('SELECT * FROM territories WHERE id = ?').get(c.territory_id);
    if (!t) continue;
    const yieldAmt = Math.floor(t.base_yield_per_hour * (1 - (c.tax_rate || 0.1)));
    if (yieldAmt > 0) {
      db.prepare('UPDATE guilds SET treasury = treasury + ? WHERE id = ?').run(yieldAmt, c.owner_id);
      db.prepare(
        `INSERT INTO player_resources (player_id, resource_type, quantity)
         SELECT leader_player_id, ?, ?
         FROM guilds WHERE id = ?
         ON CONFLICT(player_id, resource_type) DO UPDATE SET
           quantity = quantity + excluded.quantity`
      ).run(t.resource_type, Math.floor(yieldAmt * 0.1), c.owner_id);
    }
  }
}

export function mapBootstrap(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  return {
    ok: true,
    territories: listTerritoriesWithControl(),
    factions: listFactions(),
    player,
    guild: getPlayerGuild(player)
  };
}

export function realmMapLegend() {
  return listTerritoriesWithControl()
    .map(
      (t) =>
        `${resourceIcon(t.resource_type)} **${t.display_name}** — ${resourceLabel(t.resource_type)} · ${t.base_yield_per_hour}/hr · ${t.owner_label}`
    )
    .join('\n');
}

export function realmMapPngPath() {
  const candidates = [
    process.env.REALM_MAP_PNG,
    path.join(__dirname, '../../../apps/discord-bot/assets/realm-map.png'),
    path.join(__dirname, '../../../apps/web/src/public/map/realm-world.png'),
    path.join(__dirname, '../../../apps/web/src/public/map/realm-map.png')
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
