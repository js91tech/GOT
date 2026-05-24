import { getDb } from './db.js';
import { getCombatPower } from './stats.js';

function activeLabel(lastLoginDate) {
  if (!lastLoginDate) return 'inactive';
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastLoginDate === today) return 'online';
  if (lastLoginDate === yesterday) return 'recent';
  const days = Math.floor((Date.now() - new Date(`${lastLoginDate}T12:00:00Z`).getTime()) / 86400000);
  if (days <= 7) return 'recent';
  return 'inactive';
}

const ACTIVE_RANK = { online: 0, recent: 1, inactive: 2, guild: 3 };

function formatTarget(row, db, discordName) {
  const now = Date.now();
  const inHospital = row.hospital_until && new Date(row.hospital_until).getTime() > now;
  const inJail = row.jail_until && new Date(row.jail_until).getTime() > now;
  return {
    id: row.id,
    discord_id: row.discord_id,
    username: discordName || row.username,
    level: row.level,
    coins: row.coins,
    hp: row.hp,
    max_hp: row.max_hp,
    power: Math.floor(getCombatPower(row, db)),
    last_login_date: row.last_login_date,
    active: activeLabel(row.last_login_date),
    inHospital,
    inJail,
    enrolled: true,
    canAttack: !inHospital && !inJail,
    class_id: row.class_id || 'squire'
  };
}

function formatGuildOnly(member) {
  return {
    id: null,
    discord_id: member.id,
    username: member.username,
    level: null,
    coins: null,
    hp: null,
    max_hp: null,
    power: null,
    last_login_date: null,
    active: 'guild',
    inHospital: false,
    inJail: false,
    enrolled: false,
    canAttack: false
  };
}

function sortTargets(a, b) {
  const ar = ACTIVE_RANK[a.active] ?? 9;
  const br = ACTIVE_RANK[b.active] ?? 9;
  if (ar !== br) return ar - br;
  if (a.enrolled !== b.enrolled) return a.enrolled ? -1 : 1;
  return String(a.username).localeCompare(String(b.username));
}

/** Lords to show on PvP — prefer guild member IDs when provided. */
export function listPvpTargets(excludeDiscordId, guildMembers = null) {
  const db = getDb();
  const baseSql = `
    SELECT id, discord_id, username, level, coins, hp, max_hp,
           hospital_until, jail_until, last_login_date, class_id
    FROM players WHERE banned = 0 AND discord_id != ?`;

  const nameById = guildMembers
    ? Object.fromEntries(guildMembers.map((m) => [m.id, m.username]))
    : {};

  if (guildMembers?.length) {
    const ids = guildMembers.map((m) => m.id).filter((id) => id && id !== excludeDiscordId);
    let rows = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      rows = db
        .prepare(`${baseSql} AND discord_id IN (${placeholders})`)
        .all(excludeDiscordId, ...ids);
    }
    const byDiscord = Object.fromEntries(rows.map((r) => [r.discord_id, r]));
    const targets = ids.map((id) => {
      const row = byDiscord[id];
      if (row) return formatTarget(row, db, nameById[id]);
      const member = guildMembers.find((m) => m.id === id);
      return member ? formatGuildOnly(member) : null;
    }).filter(Boolean);
    return targets.sort(sortTargets);
  }

  const rows = db
    .prepare(`${baseSql} ORDER BY (last_login_date IS NULL), last_login_date DESC LIMIT 40`)
    .all(excludeDiscordId);
  return rows.map((row) => formatTarget(row, db, nameById[row.discord_id])).sort(sortTargets);
}
