import { getDb } from './db.js';
import { getOrCreatePlayer, addItem, removeItem } from './player.js';
import { audit, minutesFromNow, roll } from './util.js';
import { applyLevelUps } from './util.js';

export function delve(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  if (player.ce < 20) return { ok: false, message: 'Delve requires 20 CE.' };
  const db = getDb();
  const active = db
    .prepare(`SELECT * FROM delve_runs WHERE player_id = ? AND status = 'active'`)
    .get(player.id);
  let depth = active ? active.depth + 1 : 1;
  db.prepare('UPDATE players SET ce = ce - 20 WHERE id = ?').run(player.id);
  const danger = 0.15 + depth * 0.03;
  if (roll(danger)) {
    db.prepare('UPDATE players SET hospital_until = ? WHERE id = ?').run(
      minutesFromNow(10),
      player.id
    );
    if (active) db.prepare(`UPDATE delve_runs SET status = 'failed' WHERE id = ?`).run(active.id);
    return { ok: false, message: `Curse nest depth ${depth} — injured! Sent to infirmary.` };
  }
  const coins = Math.floor(200 * depth + Math.random() * 500);
  const xp = Math.floor(10 * depth);
  db.prepare('UPDATE players SET coins = coins + ?, xp = xp + ? WHERE id = ?').run(
    coins,
    xp,
    player.id
  );
  applyLevelUps(db, { ...player, xp: player.xp + xp });
  if (active) {
    db.prepare('UPDATE delve_runs SET depth = ? WHERE id = ?').run(depth, active.id);
  } else {
    db.prepare(`INSERT INTO delve_runs (player_id, depth) VALUES (?, ?)`).run(player.id, depth);
  }
  if (roll(0.1)) addItem(player.id, 'spirit_core', 1);
  audit(db, player.id, 'delve', coins, { depth });
  return {
    ok: true,
    message: `Delve depth ${depth}: +${coins} coins, +${xp} XP.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function endDelve(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  getDb()
    .prepare(`UPDATE delve_runs SET status = 'completed' WHERE player_id = ? AND status = 'active'`)
    .run(player.id);
  return { ok: true, message: 'Delve run ended.', player: getOrCreatePlayer(discordId, username) };
}

export function buyGrabBags(discordId, username, count = 1) {
  const player = getOrCreatePlayer(discordId, username);
  count = Math.min(2000, Math.max(1, Math.floor(count)));
  const unitCost = 5000;
  const total = unitCost * count;
  if (player.coins < total) return { ok: false, message: `Need ${total} coins for ${count} capsules.` };
  const db = getDb();
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(total, player.id);
  addItem(player.id, 'grab_bag', count);
  return {
    ok: true,
    message: `Bought ${count} Curse Capsules.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function openGrabBag(discordId, username, fromInventory = false) {
  const player = getOrCreatePlayer(discordId, username);
  if (fromInventory && !removeItem(player.id, 'grab_bag', 1)) {
    return { ok: false, message: 'No Curse Capsule in inventory.' };
  }
  const db = getDb();
  const rollTable = [
    () => ({ msg: '+500 coins', fn: () => db.prepare('UPDATE players SET coins = coins + 500 WHERE id = ?').run(player.id) }),
    () => ({ msg: '+1 gold object', fn: () => db.prepare('UPDATE players SET gold_objects = gold_objects + 1 WHERE id = ?').run(player.id) }),
    () => ({ msg: 'Power Gym Scroll (train +10%)', fn: () => addItem(player.id, 'training_weights', 1) }),
    () => ({ msg: '+50 rice', fn: () => db.prepare('UPDATE players SET rice = rice + 50 WHERE id = ?').run(player.id) }),
    () => ({ msg: 'Explosives (forge mat)', fn: () => addItem(player.id, 'iron_ore', 3) })
  ];
  const pick = rollTable[Math.floor(Math.random() * rollTable.length)]();
  pick.fn();
  return {
    ok: true,
    message: `Curse Capsule opened: ${pick.msg}`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function leaderboard(kind = 'level', limit = 10) {
  const db = getDb();
  const cols = {
    level: 'level DESC, xp DESC',
    wealth: '(coins + bank_balance) DESC',
    strength: 'strength DESC',
    defense: 'defense DESC',
    speed: 'speed DESC',
    dexterity: 'dexterity DESC',
    battle: '(strength + defense + speed + dexterity) DESC',
    pvp: null
  };
  if (kind === 'pvp') {
    return db
      .prepare(
        `SELECT p.username, p.level, COUNT(*) as wins FROM pvp_log l
         JOIN players p ON p.id = l.winner_id
         WHERE l.winner_id IS NOT NULL
         GROUP BY l.winner_id ORDER BY wins DESC LIMIT ?`
      )
      .all(limit);
  }
  const order = cols[kind] || cols.level;
  return db
    .prepare(
      `SELECT username, level, coins, bank_balance, strength, defense, speed, dexterity, world_id
       FROM players WHERE banned = 0 ORDER BY ${order} LIMIT ?`
    )
    .all(limit);
}

export function setWorld(discordId, username, worldId) {
  const allowed = ['tokyo', 'osaka', 'kyoto', 'sendai'];
  if (!allowed.includes(worldId)) return { ok: false, message: `Worlds: ${allowed.join(', ')}` };
  getDb().prepare('UPDATE players SET world_id = ? WHERE id = ?').run(
    worldId,
    getOrCreatePlayer(discordId, username).id
  );
  return { ok: true, message: `Region set to ${worldId}.`, player: getOrCreatePlayer(discordId, username) };
}

export function adminAction(adminDiscordId, action, targetDiscordId, value) {
  const admins = (process.env.ADMIN_DISCORD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!admins.includes(adminDiscordId)) return { ok: false, message: 'Not authorized.' };
  const db = getDb();
  const target = db.prepare('SELECT * FROM players WHERE discord_id = ?').get(targetDiscordId);
  if (!target) return { ok: false, message: 'Player not found.' };
  if (action === 'givecoins') {
    db.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').run(Number(value) || 0, target.id);
    return { ok: true, message: `Gave ${value} coins to ${target.username}.` };
  }
  if (action === 'setlevel') {
    db.prepare('UPDATE players SET level = ? WHERE id = ?').run(Number(value) || 1, target.id);
    return { ok: true, message: `Set ${target.username} to level ${value}.` };
  }
  if (action === 'ban') {
    db.prepare('UPDATE players SET banned = 1 WHERE id = ?').run(target.id);
    return { ok: true, message: `Banned ${target.username}.` };
  }
  if (action === 'unban') {
    db.prepare('UPDATE players SET banned = 0 WHERE id = ?').run(target.id);
    return { ok: true, message: `Unbanned ${target.username}.` };
  }
  return { ok: false, message: 'Actions: givecoins, setlevel, ban, unban' };
}
