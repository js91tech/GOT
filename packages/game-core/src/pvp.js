import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer, getPlayerByDiscord } from './player.js';
import {
  applyLevelUps,
  audit,
  canAttack,
  computeScaledXp,
  isBlocked,
  minutesFromNow,
  roll
} from './util.js';
import { getCombatPower, getEffectiveStats, getEffectiveMaxHp, getMugBonus } from './stats.js';
import { getClassModifier } from './classes.js';
import { moraleCapCost } from './energy.js';

function spendCe(db, player, percent) {
  const cost = moraleCapCost(player, percent);
  if (player.ce < cost) return null;
  db.prepare('UPDATE players SET ce = ce - ? WHERE id = ?').run(cost, player.id);
  return cost;
}

function logPvp(db, attacker, defender, action, winnerId, coins, xp, detail) {
  const a = db.prepare('SELECT id FROM players WHERE id = ?').get(attacker.id);
  const d = db.prepare('SELECT id FROM players WHERE id = ?').get(defender.id);
  if (!a || !d) return;
  try {
    db.prepare(
      `INSERT INTO pvp_log (attacker_id, defender_id, action, winner_id, coins_transferred, xp_gained, detail_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(a.id, d.id, action, winnerId || null, coins, xp, JSON.stringify(detail));
  } catch (err) {
    console.error('[pvp] log insert failed:', err.message);
  }
}

export function attack(discordId, username, targetDiscordId) {
  const attacker = getOrCreatePlayer(discordId, username);
  const block = isBlocked(attacker);
  if (block.blocked) return { ok: false, message: 'You cannot fight right now.' };
  if (String(targetDiscordId) === String(discordId)) {
    return { ok: false, message: 'You cannot attack yourself.' };
  }
  const defender = getPlayerByDiscord(targetDiscordId);
  if (!defender) {
    return { ok: false, message: 'Target has not enrolled in the realm yet — they need to log in once.' };
  }
  const check = canAttack(attacker, defender);
  if (!check.ok) return { ok: false, message: check.message };
  const db = getDb();
  const tx = db.transaction(() => {
    const ceCost = spendCe(db, attacker, balance.attackCeCostPercent);
    if (ceCost === null) return { ok: false, message: 'Not enough Morale for a duel (33%).' };
    const freshAttacker = db.prepare('SELECT * FROM players WHERE id = ?').get(attacker.id);
    const freshDefender = db.prepare('SELECT * FROM players WHERE id = ?').get(defender.id);
    if (!freshAttacker || !freshDefender) {
      return { ok: false, message: 'Target no longer available.' };
    }
    const aPow = getCombatPower(freshAttacker, db);
    const dPow = getCombatPower(freshDefender, db);
    const aStats = getEffectiveStats(freshAttacker, db);
    const dStats = getEffectiveStats(freshDefender, db);
    const cb = balance.combat || {};
    const speedEdge = (aStats.speed - dStats.speed) * (cb.speedEdgeFactor ?? 0.02);
    const aRoll = aPow * (0.85 + Math.random() * 0.3 + speedEdge);
    const dRoll = dPow * (0.85 + Math.random() * 0.3 - speedEdge * 0.5);
    let message;
    let xpGain = computeScaledXp(15, freshAttacker, 'duel');
    if (aRoll >= dRoll) {
      const aDmgMult = getClassModifier(freshAttacker, 'duelDamageMult', 1);
      const dTakenMult = getClassModifier(freshDefender, 'duelTakenMult', 1);
      const rawDmg = Math.floor((10 + aStats.strength * (cb.strDmgFactor ?? 0.5)) * aDmgMult);
      const dmg = Math.max(
        1,
        Math.floor(rawDmg * dTakenMult) - Math.floor(dStats.defense * (cb.defMitigation ?? 0.25))
      );
      const effectiveMax = getEffectiveMaxHp(freshDefender, db);
      const newHp = Math.max(0, freshDefender.hp - dmg);
      db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(newHp, freshDefender.id);
      if (newHp <= 0 || newHp < effectiveMax * 0.25 || roll(0.4)) {
        const until = minutesFromNow(balance.hospitalMinutes);
        db.prepare('UPDATE players SET hospital_until = ?, hp = max_hp WHERE id = ?').run(
          until,
          freshDefender.id
        );
      }
      db.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').run(xpGain, freshAttacker.id);
      applyLevelUps(db, { ...freshAttacker, xp: freshAttacker.xp + xpGain });
      logPvp(db, freshAttacker, freshDefender, 'attack', freshAttacker.id, 0, xpGain, {
        aRoll,
        dRoll,
        dmg
      });
      message = `You defeated ${freshDefender.username}! +${xpGain} XP. They took ${dmg} damage.`;
    } else {
      const until = minutesFromNow(balance.hospitalMinutes);
      db.prepare('UPDATE players SET hospital_until = ?, hp = max_hp WHERE id = ?').run(
        until,
        freshAttacker.id
      );
      xpGain = 0;
      logPvp(db, freshAttacker, freshDefender, 'attack', freshDefender.id, 0, 0, { aRoll, dRoll });
      message = `You lost to ${freshDefender.username} and were sent to the infirmary.`;
    }
    return { ok: true, message };
  });

  try {
    const result = tx();
    if (result.ok === false) return result;
    return { ok: true, message: result.message, player: getOrCreatePlayer(discordId, username) };
  } catch (err) {
    console.error('[pvp] attack failed:', err.message);
    return { ok: false, message: 'Duel failed — try again in a moment.' };
  }
}

export function mug(discordId, username, targetDiscordId) {
  const attacker = getOrCreatePlayer(discordId, username);
  if (String(targetDiscordId) === String(discordId)) {
    return { ok: false, message: 'You cannot mug yourself.' };
  }
  const defender = getPlayerByDiscord(targetDiscordId);
  if (!defender) return { ok: false, message: 'Target has not enrolled in the realm yet.' };
  const check = canAttack(attacker, defender);
  if (!check.ok) return { ok: false, message: check.message };
  const db = getDb();
  const tx = db.transaction(() => {
    if (spendCe(db, attacker, balance.mugCeCostPercent) === null) {
      return { ok: false, message: 'Not enough Morale to mug (15%).' };
    }
    const freshDefender = db.prepare('SELECT * FROM players WHERE id = ?').get(defender.id);
    if (!freshDefender) return { ok: false, message: 'Target no longer available.' };
    const maxSteal = Math.floor(freshDefender.coins * balance.mugMaxPercent);
    const stolen = Math.min(maxSteal, Math.floor((500 + Math.random() * 2000) * getMugBonus(attacker, db)));
    if (stolen <= 0) return { ok: false, message: 'Target has no coins to mug.' };
    db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(stolen, freshDefender.id);
    const mugXp = computeScaledXp(5, attacker, 'duel');
    db.prepare('UPDATE players SET coins = coins + ?, xp = xp + ? WHERE id = ?').run(stolen, mugXp, attacker.id);
    applyLevelUps(db, { ...attacker, xp: attacker.xp + mugXp });
    logPvp(db, attacker, freshDefender, 'mug', attacker.id, stolen, mugXp, {});
    return { ok: true, message: `Mugged ${freshDefender.username} for ${stolen} coins!` };
  });
  try {
    const result = tx();
    if (result.ok === false) return result;
    return { ok: true, message: result.message, player: getOrCreatePlayer(discordId, username) };
  } catch (err) {
    console.error('[pvp] mug failed:', err.message);
    return { ok: false, message: 'Mug failed — try again in a moment.' };
  }
}

export function rob(discordId, username, targetDiscordId) {
  const attacker = getOrCreatePlayer(discordId, username);
  if (String(targetDiscordId) === String(discordId)) {
    return { ok: false, message: 'You cannot rob yourself.' };
  }
  const defender = getPlayerByDiscord(targetDiscordId);
  if (!defender) return { ok: false, message: 'Target has not enrolled in the realm yet.' };
  const check = canAttack(attacker, defender);
  if (!check.ok) return { ok: false, message: check.message };
  const db = getDb();
  const tx = db.transaction(() => {
    const listings = db.prepare('SELECT COUNT(*) as c FROM market_listings WHERE seller_id = ?').get(defender.id);
    if (listings.c > 0) {
      return { ok: false, message: 'Cannot rob while target has active market listings (realm law).' };
    }
    if (spendCe(db, attacker, balance.robCeCostPercent) === null) {
      return { ok: false, message: 'Not enough Morale to rob (25%).' };
    }
    const freshDefender = db.prepare('SELECT * FROM players WHERE id = ?').get(defender.id);
    if (!freshDefender) return { ok: false, message: 'Target no longer available.' };
    const stolen = Math.min(freshDefender.coins, balance.robMaxCoins, Math.floor(1000 + Math.random() * 10000));
    if (stolen <= 0) return { ok: false, message: 'Nothing to rob.' };
    db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(stolen, freshDefender.id);
    const robXp = computeScaledXp(10, attacker, 'duel');
    db.prepare('UPDATE players SET coins = coins + ?, xp = xp + ? WHERE id = ?').run(stolen, robXp, attacker.id);
    applyLevelUps(db, { ...attacker, xp: attacker.xp + robXp });
    logPvp(db, attacker, freshDefender, 'rob', attacker.id, stolen, robXp, {});
    return { ok: true, message: `Robbed ${freshDefender.username} for ${stolen} coins!` };
  });
  try {
    const result = tx();
    if (result.ok === false) return result;
    return { ok: true, message: result.message, player: getOrCreatePlayer(discordId, username) };
  } catch (err) {
    console.error('[pvp] rob failed:', err.message);
    return { ok: false, message: 'Rob failed — try again in a moment.' };
  }
}

export function bustOut(discordId, username, targetDiscordId) {
  const rescuer = getOrCreatePlayer(discordId, username);
  const target = getPlayerByDiscord(targetDiscordId);
  if (!target) return { ok: false, message: 'Target not found.' };
  if (!target.jail_until || new Date(target.jail_until).getTime() <= Date.now()) {
    return { ok: false, message: 'They are not in the Black Cells.' };
  }
  const db = getDb();
  db.prepare('UPDATE players SET jail_until = NULL WHERE id = ?').run(target.id);
  const bustXp = computeScaledXp(balance.bustXp, rescuer, 'general');
  db.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').run(bustXp, rescuer.id);
  applyLevelUps(db, { ...rescuer, xp: rescuer.xp + bustXp });
  audit(db, rescuer.id, 'bust', bustXp, { target: target.id });
  return {
    ok: true,
    message: `Broke ${target.username} out! +${bustXp} XP.`,
    player: getOrCreatePlayer(discordId, username)
  };
}
