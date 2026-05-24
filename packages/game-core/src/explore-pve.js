import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import balance from './balance.json' with { type: 'json' };
import { getDb } from './db.js';
import { getOrCreatePlayer, addItem } from './player.js';
import { audit, applyLevelUps, minutesFromNow, roll, isBlocked, computeScaledXp } from './util.js';
import {
  getEffectiveStats,
  getEffectiveMaxHp,
  syncPlayerMaxHp
} from './stats.js';
import { getClassModifier } from './classes.js';
import { resolveLegacyId } from './got-theme.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mobsCache = null;

function loadMobs() {
  if (!mobsCache) {
    const p = path.join(__dirname, '../data/mobs.json');
    mobsCache = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return mobsCache;
}

export function findMob(areaId, mobId) {
  const pool = loadMobs()[resolveLegacyId(areaId)];
  if (!pool) return null;
  return pool.mobs.find((m) => m.id === mobId) || null;
}

export function getPendingEncounter(player) {
  const raw = player.pve_encounter_json;
  if (!raw || raw === '' || raw === '{}') return null;
  try {
    const data = JSON.parse(raw);
    if (!data?.mobId || !data?.areaId) return null;
    const mob = findMob(data.areaId, data.mobId);
    if (!mob) return null;
    return { ...data, mob };
  } catch {
    return null;
  }
}

function setPendingEncounter(playerId, areaId, mob) {
  const db = getDb();
  db.prepare('UPDATE players SET pve_encounter_json = ? WHERE id = ?').run(
    JSON.stringify({ mobId: mob.id, areaId: resolveLegacyId(areaId) }),
    playerId
  );
}

export function clearPendingEncounter(playerId) {
  getDb().prepare("UPDATE players SET pve_encounter_json = '' WHERE id = ?").run(playerId);
}

export function formatEncounterPrompt(mob) {
  return (
    `⚠️ **You've encountered ${mob.emoji} ${mob.name}!** (Lv${mob.level})\n` +
    `STR ${mob.strength} · DEF ${mob.defense} · HP ${mob.hp}\n` +
    `Choose **Attack** or **Flee** — fleeing can fail.`
  );
}

/** 0–100 display risk for area + optional room multiplier. */
export function getExploreRisk(areaId, room) {
  const pool = loadMobs()[resolveLegacyId(areaId)];
  if (!pool) return { tier: 0, label: 'Unknown', chancePercent: 0 };
  const mult = room?.encounter_mult ?? 1;
  const cfg = balance.pve || {};
  const tierBonus = (pool.tier - 1) * (cfg.tierChanceBonus ?? 0.03);
  const chance = Math.min(
    cfg.maxEncounterChance ?? 0.65,
    pool.encounter_base * mult + tierBonus
  );
  const labels = ['Peaceful', 'Low', 'Moderate', 'High', 'Deadly'];
  return {
    tier: pool.tier,
    label: labels[Math.min(pool.tier, labels.length - 1)] || 'Moderate',
    chancePercent: Math.round(chance * 100)
  };
}

function pickMob(areaId, playerLevel) {
  const pool = loadMobs()[resolveLegacyId(areaId)];
  if (!pool?.mobs?.length) return null;
  const eligible = pool.mobs.filter((m) => m.level <= playerLevel + 3);
  const list = eligible.length ? eligible : pool.mobs;
  return list[Math.floor(Math.random() * list.length)];
}

function rollDrops(mob, db) {
  const drops = [];
  for (const d of mob.drops || []) {
    if (!roll(d.chance)) continue;
    const item = db.prepare('SELECT id, name FROM item_definitions WHERE id = ?').get(d.item);
    if (!item) continue;
    const qty = d.qty_max ? Math.floor(d.qty_min + Math.random() * (d.qty_max - d.qty_min + 1)) : 1;
    drops.push({ itemId: d.item, name: item.name, qty });
  }
  return drops;
}

function runAutoBattle(player, mob, db) {
  const pStats = getEffectiveStats(player, db);
  const cb = balance.pve || {};
  const maxRounds = cb.maxRounds ?? 12;
  let mobHp = mob.hp;
  let playerHp = player.hp;
  const log = [];

  for (let round = 1; round <= maxRounds && mobHp > 0 && playerHp > 0; round++) {
    const pDmg = Math.max(
      1,
      Math.floor(4 + pStats.strength * (cb.playerStrFactor ?? 0.45)) -
        Math.floor(mob.defense * (cb.mobDefMitigation ?? 0.2))
    );
    const crit = roll(pStats.dexterity * (cb.dexCritChance ?? 0.004));
    const dealt = crit ? Math.floor(pDmg * 1.5) : pDmg;
    mobHp -= dealt;
    log.push(`You strike for ${dealt}${crit ? ' (crit)' : ''}.`);

    if (mobHp <= 0) break;

    const mDmg = Math.max(
      1,
      Math.floor(3 + mob.strength * (cb.mobStrFactor ?? 0.38)) -
        Math.floor(pStats.defense * (cb.playerDefMitigation ?? 0.28))
    );
    const dodge = roll(pStats.speed * (cb.speedDodgeChance ?? 0.003));
    if (dodge) {
      log.push(`${mob.name} misses (you dodge).`);
    } else {
      playerHp -= mDmg;
      log.push(`${mob.name} hits you for ${mDmg}.`);
    }
  }

  const win = mobHp <= 0 && playerHp > 0;
  const maxHp = getEffectiveMaxHp(player, db);
  const newHp = win ? Math.min(maxHp, playerHp) : 0;
  return { win, playerHp: newHp, log, rounds: log.length };
}

function mobFreeHit(player, mob, db) {
  const pStats = getEffectiveStats(player, db);
  const cb = balance.pve || {};
  const mDmg = Math.max(
    1,
    Math.floor(3 + mob.strength * (cb.mobStrFactor ?? 0.38)) -
      Math.floor(pStats.defense * (cb.playerDefMitigation ?? 0.28))
  );
  const dodge = roll(pStats.speed * (cb.speedDodgeChance ?? 0.003));
  if (dodge) return { damage: 0, message: `${mob.name} lunges but you slip away — for now.` };
  const maxHp = getEffectiveMaxHp(player, db);
  const newHp = Math.max(0, player.hp - mDmg);
  db.prepare('UPDATE players SET hp = ? WHERE id = ?').run(newHp, player.id);
  return { damage: mDmg, message: `${mob.name} catches you for ${mDmg} damage!`, playerHp: newHp, maxHp };
}

function applyVictory(db, player, mob, battle) {
  const coins =
    mob.coins_min + Math.floor(Math.random() * (mob.coins_max - mob.coins_min + 1));
  const xp = computeScaledXp(mob.xp, player, 'pve');
  db.prepare('UPDATE players SET hp = ?, coins = coins + ?, xp = xp + ? WHERE id = ?').run(
    battle.playerHp,
    coins,
    xp,
    player.id
  );
  applyLevelUps(db, { ...player, xp: player.xp + xp, coins: player.coins + coins });
  const drops = rollDrops(mob, db);
  for (const d of drops) addItem(player.id, d.itemId, d.qty);
  audit(db, player.id, 'pve_win', coins, { mob: mob.id, xp, drops: drops.map((d) => d.itemId) });
  return { coins, xp, drops };
}

function applyDefeat(db, player) {
  const mins = balance.pve?.hospitalMinutes ?? balance.hospitalMinutes;
  const until = minutesFromNow(mins);
  const maxHp = getEffectiveMaxHp(player, db);
  db.prepare('UPDATE players SET hospital_until = ?, hp = ? WHERE id = ?').run(
    until,
    maxHp,
    player.id
  );
  audit(db, player.id, 'pve_loss', 0, {});
}

export function mustResolveEncounter(player) {
  const pending = getPendingEncounter(player);
  if (!pending) return null;
  return {
    ok: false,
    message: `You're engaged with **${pending.mob.emoji} ${pending.mob.name}**! Attack or flee first.`,
    encounterPending: true,
    pending
  };
}

/**
 * Roll for encounter and store pending state (no auto-fight).
 */
export function tryPveEncounter(discordId, username, opts) {
  const player = getOrCreatePlayer(discordId, username);
  const existing = mustResolveEncounter(player);
  if (existing) return existing;

  const block = isBlocked(player);
  if (block.blocked) {
    if (block.reason === 'hospital') {
      return { ok: false, message: 'You are in the maester\'s tent and cannot fight.' };
    }
    return null;
  }

  const areaId = resolveLegacyId(opts.areaId);
  const room = opts.room || {};
  const mult = room.encounter_mult ?? 1;
  if (mult <= 0 && !opts.force && !opts.hunt) return null;

  const pool = loadMobs()[areaId];
  if (!pool) return null;

  const risk = getExploreRisk(areaId, room);
  const cfg = balance.pve || {};
  let chance = risk.chancePercent / 100;
  if (opts.hunt) chance = Math.min(cfg.maxEncounterChance ?? 0.65, chance + (cfg.huntBonus ?? 0.35));
  if (opts.force) chance = 1;
  if (!opts.force && !opts.hunt && !roll(chance)) return null;

  const mob = pickMob(areaId, player.level);
  if (!mob) return null;

  setPendingEncounter(player.id, areaId, mob);
  const message = formatEncounterPrompt(mob);
  return {
    ok: true,
    pending: true,
    encounterPending: true,
    mob,
    message
  };
}

export function pveAttack(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const pending = getPendingEncounter(player);
  if (!pending) {
    return { ok: false, message: 'No enemy to fight here.' };
  }
  const block = isBlocked(player);
  if (block.blocked) {
    return { ok: false, message: 'You cannot fight right now.' };
  }

  const mob = pending.mob;
  const db = getDb();
  const fresh = db.prepare('SELECT * FROM players WHERE id = ?').get(player.id);
  const battle = runAutoBattle(fresh, mob, db);
  clearPendingEncounter(player.id);

  if (battle.win) {
    const rewards = applyVictory(db, fresh, mob, battle);
    syncPlayerMaxHp(db, player.id);
    const dropText =
      rewards.drops.length > 0
        ? rewards.drops.map((d) => `${d.qty}x ${d.name}`).join(', ')
        : 'nothing';
    const updated = getOrCreatePlayer(discordId, username);
    const maxHp = getEffectiveMaxHp(updated, db);
    const message =
      `⚔️ **${mob.emoji} ${mob.name}** — **Victory!**\n` +
      `${battle.log.slice(-4).join(' ')}\n` +
      `+${rewards.xp} XP, +${rewards.coins} gold` +
      (rewards.drops.length ? ` · Loot: ${dropText}` : '') +
      ` · HP ${battle.playerHp}/${maxHp}`;
    return { ok: true, win: true, message, player: updated };
  }

  applyDefeat(db, fresh);
  const message =
    `⚔️ **${mob.emoji} ${mob.name}** — **Defeat**\n` +
    `${battle.log.slice(-4).join(' ')}\n` +
    `Sent to the maester's tent for ${balance.pve?.hospitalMinutes ?? balance.hospitalMinutes} minutes.`;
  return { ok: true, win: false, message, player: getOrCreatePlayer(discordId, username) };
}

export function pveFlee(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const pending = getPendingEncounter(player);
  if (!pending) {
    return { ok: false, message: 'Nothing to flee from.' };
  }

  const mob = pending.mob;
  const db = getDb();
  const fresh = db.prepare('SELECT * FROM players WHERE id = ?').get(player.id);
  const pStats = getEffectiveStats(fresh, db);
  const cfg = balance.pve || {};
  let fleeChance =
    (cfg.fleeBase ?? 0.4) +
    (pStats.speed - mob.speed) * (cfg.fleeSpeedFactor ?? 0.02) +
    pStats.dexterity * (cfg.fleeDexFactor ?? 0.003);
  fleeChance *= getClassModifier(fresh, 'fleeMult', 1);
  fleeChance = Math.min(cfg.fleeMax ?? 0.85, Math.max(cfg.fleeMin ?? 0.15, fleeChance));

  if (roll(fleeChance)) {
    clearPendingEncounter(player.id);
    const message =
      `🏃 You escape from **${mob.emoji} ${mob.name}**! (${Math.round(fleeChance * 100)}% flee chance)`;
    return { ok: true, fled: true, message, player: getOrCreatePlayer(discordId, username) };
  }

  const hit = mobFreeHit(fresh, mob, db);
  const updated = getOrCreatePlayer(discordId, username);
  const maxHp = getEffectiveMaxHp(updated, db);

  if (hit.playerHp !== undefined && hit.playerHp <= 0) {
    clearPendingEncounter(player.id);
    applyDefeat(db, updated);
    return {
      ok: true,
      fled: false,
      message:
        `🏃 **Flee failed!** ${hit.message}\n` +
        `Overwhelmed — sent to the maester's tent for ${balance.pve?.hospitalMinutes ?? balance.hospitalMinutes} minutes.`,
      player: getOrCreatePlayer(discordId, username)
    };
  }

  const message =
    `🏃 **Flee failed!** (${Math.round(fleeChance * 100)}% chance)\n` +
    `${hit.message}\n` +
    (hit.playerHp !== undefined ? `HP ${hit.playerHp}/${maxHp}. ` : '') +
    `**${mob.emoji} ${mob.name}** still blocks your path — attack or flee again.`;
  return {
    ok: true,
    fled: false,
    encounterPending: true,
    pending,
    message,
    player: updated
  };
}

export function exploreHunt(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const blocked = mustResolveEncounter(player);
  if (blocked) return blocked;

  const areas = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/areas.json'), 'utf8')
  );
  const areaId = resolveLegacyId(player.explore_area || 'winterfell');
  const area = areas[areaId];
  const roomId = player.explore_room || Object.keys(area?.rooms || {})[0];
  const room = area?.rooms?.[roomId];
  if (!room) return { ok: false, message: 'You are lost.' };
  if ((room.encounter_mult ?? 1) <= 0) {
    return { ok: false, message: 'This area is too safe to hunt — march to wilder rooms.' };
  }
  const encounter = tryPveEncounter(discordId, username, { areaId, room, hunt: true });
  if (!encounter) {
    return {
      ok: true,
      message: 'You stalk the paths but no foe appears this time. Try again or travel deeper.',
      player: getOrCreatePlayer(discordId, username)
    };
  }
  return {
    ok: encounter.ok !== false,
    message: encounter.message,
    encounterPending: encounter.encounterPending,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function formatRiskLine(areaId, room) {
  const risk = getExploreRisk(areaId, room);
  return `PvE risk: **${risk.label}** (~${risk.chancePercent}% encounter per march)`;
}
