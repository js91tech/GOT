import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { processTicks } from './tick.js';
import { applyLevelUps, audit, gradeName, isBlocked } from './util.js';

export function getOrCreatePlayer(discordId, username = 'Lord') {
  const db = getDb();
  let player = db.prepare('SELECT * FROM players WHERE discord_id = ?').get(discordId);
  if (!player) {
    db.prepare(
      `INSERT INTO players (discord_id, username, ce, focus, resolve, rice)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(discordId, username, balance.ceMax, 100, 100, 10);
    player = db.prepare('SELECT * FROM players WHERE discord_id = ?').get(discordId);
    db.prepare(
      `INSERT INTO inventory_items (player_id, item_id, quantity) VALUES (?, 'healers_kit', 5)`
    ).run(player.id);
    audit(db, player.id, 'register', 0, {});
  }
  player = processTicks(player);
  const today = new Date().toISOString().slice(0, 10);
  if (player.last_login_date !== today) {
    const streak =
      player.last_login_date ===
      new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        ? player.login_streak + 1
        : 1;
    const bonusCoins = balance.dailyLoginCoins * Math.min(streak, 7);
    db.prepare(
      `UPDATE players SET last_login_date = ?, login_streak = ?, coins = coins + ?, xp = xp + ? WHERE id = ?`
    ).run(today, streak, bonusCoins, balance.dailyLoginXp, player.id);
    applyLevelUps(db, { ...player, xp: player.xp + balance.dailyLoginXp });
    player = db.prepare('SELECT * FROM players WHERE id = ?').get(player.id);
  }
  return formatPlayer(player);
}

export function formatPlayer(p) {
  return {
    ...p,
    grade: gradeName(p.level),
    total_wealth: p.coins + p.bank_balance,
    education: JSON.parse(p.education_json || '[]')
  };
}

export function getPlayerById(id) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM players WHERE id = ?').get(id);
  return p ? formatPlayer(processTicks(p)) : null;
}

export function getPlayerByDiscord(discordId) {
  const db = getDb();
  const p = db.prepare('SELECT * FROM players WHERE discord_id = ?').get(discordId);
  return p ? formatPlayer(processTicks(p)) : null;
}

export function getInventory(playerId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT inv.*, i.name, i.description, i.item_type, i.effects_json, i.shop_price
       FROM inventory_items inv
       JOIN item_definitions i ON i.id = inv.item_id
       WHERE inv.player_id = ?`
    )
    .all(playerId);
}

export function addItem(playerId, itemId, qty = 1) {
  const db = getDb();
  const existing = db
    .prepare('SELECT id, quantity FROM inventory_items WHERE player_id = ? AND item_id = ?')
    .get(playerId, itemId);
  if (existing) {
    db.prepare('UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?').run(qty, existing.id);
  } else {
    db.prepare('INSERT INTO inventory_items (player_id, item_id, quantity) VALUES (?, ?, ?)').run(
      playerId,
      itemId,
      qty
    );
  }
}

export function removeItem(playerId, itemId, qty = 1) {
  const db = getDb();
  const row = db
    .prepare('SELECT id, quantity FROM inventory_items WHERE player_id = ? AND item_id = ?')
    .get(playerId, itemId);
  if (!row || row.quantity < qty) return false;
  if (row.quantity === qty) {
    db.prepare('DELETE FROM inventory_items WHERE id = ?').run(row.id);
  } else {
    db.prepare('UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?').run(qty, row.id);
  }
  return true;
}

export function getStatus(player) {
  const block = isBlocked(player);
  return {
    grade: player.grade,
    level: player.level,
    xp: player.xp,
    coins: player.coins,
    bank: player.bank_balance,
    gold_objects: player.gold_objects,
    rice: player.rice,
    ce: player.ce,
    focus: player.focus,
    resolve: player.resolve,
    strength: player.strength,
    defense: player.defense,
    speed: player.speed,
    dexterity: player.dexterity,
    manual_labor: player.manual_labor,
    intelligence: player.intelligence,
    endurance: player.endurance,
    technique: player.technique,
    gym_id: player.gym_id,
    company_id: player.company_id,
    hp: player.hp,
    max_hp: player.max_hp,
    bravery: player.bravery,
    hospital_until: player.hospital_until,
    jail_until: player.jail_until,
    login_streak: player.login_streak,
    wheel_spins_left: balance.wheelDailySpins - player.wheel_spins_today,
    blocked: block
  };
}
