import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer, getPlayerByDiscord } from './player.js';
import {
  applyLevelUps,
  audit,
  canAttack,
  isBlocked,
  minutesFromNow,
  roll
} from './util.js';
import { getCombatPower, getEffectiveStats } from './stats.js';

function spendCe(db, player, percent) {
  const cost = Math.ceil((balance.ceMax * percent) / 100);
  if (player.ce < cost) return null;
  db.prepare('UPDATE players SET ce = ce - ? WHERE id = ?').run(cost, player.id);
  return cost;
}

function logPvp(db, attacker, defender, action, winnerId, coins, xp, detail) {
  db.prepare(
    `INSERT INTO pvp_log (attacker_id, defender_id, action, winner_id, coins_transferred, xp_gained, detail_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(attacker.id, defender.id, action, winnerId, coins, xp, JSON.stringify(detail));
}

export function attack(discordId, username, targetDiscordId) {
  const attacker = getOrCreatePlayer(discordId, username);
  const block = isBlocked(attacker);
  if (block.blocked) return { ok: false, message: 'You cannot fight right now.' };
  const defender = getPlayerByDiscord(targetDiscordId);
  if (!defender) return { ok: false, message: 'Target not found.' };
  const check = canAttack(attacker, defender);
  if (!check.ok) return { ok: false, message: check.message };
  const db = getDb();
  const ceCost = spendCe(db, attacker, balance.attackCeCostPercent);
  if (ceCost === null) return { ok: false, message: 'Not enough CE for a duel (33%).' };
  const aPow = getCombatPower(attacker, db);
  const dPow = getCombatPower(defender, db);
  const aStats = getEffectiveStats(attacker, db);
  const dStats = getEffectiveStats(defender, db);
  const speedEdge = (aStats.speed - dStats.speed) * 0.02;
  const aRoll = aPow * (0.85 + Math.random() * 0.3 + speedEdge);
  const dRoll = dPow * (0.85 + Math.random() * 0.3 - speedEdge * 0.5);
  let message;
  let xpGain = 15;
  if (aRoll >= dRoll) {
    const rawDmg = Math.floor(10 + aStats.strength * 0.5);
    const dmg = Math.max(1, rawDmg - Math.floor(dStats.defense * 0.25));
    const newHp = Math.max(0, defender.hp - dmg);
    db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(newHp, defender.id);
    if (newHp <= 0 || roll(0.4)) {
      const until = minutesFromNow(balance.hospitalMinutes);
      db.prepare('UPDATE players SET hospital_until = ?, hp = max_hp WHERE id = ?').run(until, defender.id);
    }
    db.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').run(xpGain, attacker.id);
    applyLevelUps(db, { ...attacker, xp: attacker.xp + xpGain });
    logPvp(db, attacker, defender, 'attack', attacker.id, 0, xpGain, { aRoll, dRoll, dmg });
    message = `You defeated ${defender.username}! +${xpGain} XP. They took ${dmg} damage.`;
  } else {
    const until = minutesFromNow(balance.hospitalMinutes);
    db.prepare('UPDATE players SET hospital_until = ?, hp = max_hp WHERE id = ?').run(until, attacker.id);
    xpGain = 0;
    logPvp(db, attacker, defender, 'attack', defender.id, 0, 0, { aRoll, dRoll });
    message = `You lost to ${defender.username} and were sent to the infirmary.`;
  }
  return { ok: true, message, player: getOrCreatePlayer(discordId, username) };
}

export function mug(discordId, username, targetDiscordId) {
  const attacker = getOrCreatePlayer(discordId, username);
  const defender = getPlayerByDiscord(targetDiscordId);
  if (!defender) return { ok: false, message: 'Target not found.' };
  const check = canAttack(attacker, defender);
  if (!check.ok) return { ok: false, message: check.message };
  const db = getDb();
  if (spendCe(db, attacker, balance.mugCeCostPercent) === null) {
    return { ok: false, message: 'Not enough CE to mug (15%).' };
  }
  const maxSteal = Math.floor(defender.coins * balance.mugMaxPercent);
  const stolen = Math.min(maxSteal, Math.floor(500 + Math.random() * 2000));
  if (stolen <= 0) return { ok: false, message: 'Target has no coins to mug.' };
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(stolen, defender.id);
  db.prepare('UPDATE players SET coins = coins + ?, xp = xp + 5 WHERE id = ?').run(stolen, attacker.id);
  applyLevelUps(db, { ...attacker, xp: attacker.xp + 5 });
  logPvp(db, attacker, defender, 'mug', attacker.id, stolen, 5, {});
  return {
    ok: true,
    message: `Mugged ${defender.username} for ${stolen} coins!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function rob(discordId, username, targetDiscordId) {
  const attacker = getOrCreatePlayer(discordId, username);
  const defender = getPlayerByDiscord(targetDiscordId);
  if (!defender) return { ok: false, message: 'Target not found.' };
  const check = canAttack(attacker, defender);
  if (!check.ok) return { ok: false, message: check.message };
  const listings = getDb()
    .prepare('SELECT COUNT(*) as c FROM market_listings WHERE seller_id = ?')
    .get(defender.id);
  if (listings.c > 0) {
    return { ok: false, message: 'Cannot rob while target has active market listings (SoL rule).' };
  }
  const db = getDb();
  if (spendCe(db, attacker, balance.robCeCostPercent) === null) {
    return { ok: false, message: 'Not enough CE to rob (25%).' };
  }
  const stolen = Math.min(defender.coins, balance.robMaxCoins, Math.floor(1000 + Math.random() * 10000));
  if (stolen <= 0) return { ok: false, message: 'Nothing to rob.' };
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(stolen, defender.id);
  db.prepare('UPDATE players SET coins = coins + ?, xp = xp + 10 WHERE id = ?').run(stolen, attacker.id);
  applyLevelUps(db, { ...attacker, xp: attacker.xp + 10 });
  logPvp(db, attacker, defender, 'rob', attacker.id, stolen, 10, {});
  return {
    ok: true,
    message: `Robbed ${defender.username} for ${stolen} coins!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function bustOut(discordId, username, targetDiscordId) {
  const rescuer = getOrCreatePlayer(discordId, username);
  const target = getPlayerByDiscord(targetDiscordId);
  if (!target) return { ok: false, message: 'Target not found.' };
  if (!target.jail_until || new Date(target.jail_until).getTime() <= Date.now()) {
    return { ok: false, message: 'They are not in the Prison Realm.' };
  }
  const db = getDb();
  db.prepare('UPDATE players SET jail_until = NULL WHERE id = ?').run(target.id);
  db.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').run(balance.bustXp, rescuer.id);
  applyLevelUps(db, { ...rescuer, xp: rescuer.xp + balance.bustXp });
  audit(db, rescuer.id, 'bust', balance.bustXp, { target: target.id });
  return {
    ok: true,
    message: `Broke ${target.username} out! +${balance.bustXp} XP.`,
    player: getOrCreatePlayer(discordId, username)
  };
}
