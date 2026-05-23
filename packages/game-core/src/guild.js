import { getDb } from './db.js';
import { getOrCreatePlayer } from './player.js';

const CREATE_COST = 5000;
const MAX_MEMBERS_BASE = 12;

export function getPlayerGuild(player) {
  if (!player?.guild_id) return null;
  return getDb().prepare('SELECT * FROM guilds WHERE id = ?').get(player.guild_id);
}

export function listGuildMembers(guildId) {
  return getDb()
    .prepare(
      `SELECT p.id, p.username, p.discord_id, gm.role
       FROM guild_members gm
       JOIN players p ON p.id = gm.player_id
       WHERE gm.guild_id = ?
       ORDER BY gm.role, p.username`
    )
    .all(guildId);
}

export function createGuild(discordId, username, name, tag) {
  const player = getOrCreatePlayer(discordId, username);
  if (player.guild_id) return { ok: false, message: 'Leave your current guild first.' };
  name = String(name || '').trim().slice(0, 32);
  tag = String(tag || '')
    .trim()
    .toUpperCase()
    .slice(0, 5);
  if (name.length < 3) return { ok: false, message: 'Guild name must be at least 3 characters.' };
  if (tag.length < 2) return { ok: false, message: 'Guild tag must be 2–5 letters.' };
  const db = getDb();
  if (db.prepare('SELECT id FROM guilds WHERE tag = ?').get(tag)) {
    return { ok: false, message: 'That tag is taken.' };
  }
  if (player.coins < CREATE_COST) {
    return { ok: false, message: `Founding a guild costs ${CREATE_COST} gold.` };
  }
  const info = db
    .prepare(
      `INSERT INTO guilds (name, tag, leader_player_id, faction_id, treasury)
       VALUES (?, ?, ?, ?, 0)`
    )
    .run(name, tag, player.id, player.faction_id || null);
  const guildId = info.lastInsertRowid;
  db.prepare('UPDATE players SET coins = coins - ?, guild_id = ? WHERE id = ?').run(
    CREATE_COST,
    guildId,
    player.id
  );
  db.prepare(
    'INSERT INTO guild_members (guild_id, player_id, role) VALUES (?, ?, ?)'
  ).run(guildId, player.id, 'leader');
  return {
    ok: true,
    message: `Guild [${tag}] ${name} founded!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function joinGuild(discordId, username, guildId) {
  const player = getOrCreatePlayer(discordId, username);
  if (player.guild_id) return { ok: false, message: 'Already in a guild.' };
  const db = getDb();
  const guild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);
  if (!guild) return { ok: false, message: 'Guild not found.' };
  const count = db
    .prepare('SELECT COUNT(*) AS c FROM guild_members WHERE guild_id = ?')
    .get(guildId).c;
  if (count >= MAX_MEMBERS_BASE) return { ok: false, message: 'Guild is full.' };
  db.prepare('INSERT INTO guild_members (guild_id, player_id, role) VALUES (?, ?, ?)').run(
    guildId,
    player.id,
    'member'
  );
  db.prepare('UPDATE players SET guild_id = ? WHERE id = ?').run(guildId, player.id);
  return {
    ok: true,
    message: `Joined [${guild.tag}] ${guild.name}.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function leaveGuild(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  if (!player.guild_id) return { ok: false, message: 'Not in a guild.' };
  const db = getDb();
  const guild = getPlayerGuild(player);
  const isLeader =
    db
      .prepare('SELECT role FROM guild_members WHERE guild_id = ? AND player_id = ?')
      .get(player.guild_id, player.id)?.role === 'leader';
  if (isLeader) {
    const others = db
      .prepare('SELECT player_id FROM guild_members WHERE guild_id = ? AND player_id != ?')
      .all(player.guild_id, player.id);
    if (others.length > 0) {
      return { ok: false, message: 'Promote another officer or disband before leaving as leader.' };
    }
    db.prepare('DELETE FROM guilds WHERE id = ?').run(player.guild_id);
  }
  db.prepare('DELETE FROM guild_members WHERE guild_id = ? AND player_id = ?').run(
    player.guild_id,
    player.id
  );
  db.prepare('UPDATE players SET guild_id = NULL WHERE id = ?').run(player.id);
  return {
    ok: true,
    message: guild ? `Left [${guild.tag}] ${guild.name}.` : 'Left guild.',
    player: getOrCreatePlayer(discordId, username)
  };
}

export function guildDeposit(discordId, username, amount) {
  const player = getOrCreatePlayer(discordId, username);
  if (!player.guild_id) return { ok: false, message: 'Not in a guild.' };
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0 || player.coins < amount) return { ok: false, message: 'Invalid amount.' };
  const db = getDb();
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(amount, player.id);
  db.prepare('UPDATE guilds SET treasury = treasury + ? WHERE id = ?').run(amount, player.guild_id);
  return {
    ok: true,
    message: `Deposited ${amount} gold to guild treasury.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function listGuilds(limit = 20) {
  return getDb()
    .prepare(
      `SELECT g.*, COUNT(gm.player_id) AS member_count
       FROM guilds g
       LEFT JOIN guild_members gm ON gm.guild_id = g.id
       GROUP BY g.id
       ORDER BY g.treasury DESC
       LIMIT ?`
    )
    .all(limit);
}

export function isGuildOfficer(player) {
  if (!player?.guild_id) return false;
  const row = getDb()
    .prepare('SELECT role FROM guild_members WHERE guild_id = ? AND player_id = ?')
    .get(player.guild_id, player.id);
  return row && (row.role === 'leader' || row.role === 'officer');
}
