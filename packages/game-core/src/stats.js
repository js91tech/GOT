import balance from './balance.json' with { type: 'json' };
import { getClassStatBonuses, getClassModifier, getClassProgress, formatClassBonuses } from './classes.js';

export const TRAIN_STATS = ['strength', 'defense', 'speed', 'dexterity'];
export const WORKER_STATS = ['manual_labor', 'intelligence', 'endurance', 'technique'];

export const TRAIN_STAT_LABELS = {
  strength: 'Strength',
  defense: 'Defense',
  speed: 'Speed',
  dexterity: 'Dexterity',
  manual_labor: 'Labor',
  intelligence: 'Intelligence',
  endurance: 'Endurance',
  technique: 'Technique'
};

export const STAT_EFFECTS = {
  strength: 'More PvP damage, higher mission coin loot, stronger siege blows',
  defense: 'Reduces damage taken in duels, lowers injury chance on failed missions',
  speed: 'Initiative edge in duels, faster work cooldown recovery',
  dexterity: 'Better mug/rob success, lower mission detection, training crit chance',
  manual_labor: 'Boosts physical company work payouts',
  intelligence: 'Boosts scholar company work payouts',
  endurance: 'Boosts patrol company work, reduces hospital time on mission fail',
  technique: 'Boosts vault/security work, improves training XP gains'
};

export function normalizeTrainStat(stat) {
  const key = String(stat || 'strength').toLowerCase();
  return TRAIN_STATS.includes(key) ? key : 'strength';
}

function equippedRows(player, db) {
  return db
    .prepare(
      `SELECT i.effects_json, i.item_type, i.name, inv.equip_slot
       FROM inventory_items inv
       JOIN item_definitions i ON i.id = inv.item_id
       WHERE inv.player_id = ? AND inv.equip_slot IS NOT NULL`
    )
    .all(player.id);
}

function parseEffects(json) {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return {};
  }
}

export function getGearStatBonuses(player, db) {
  const bonuses = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
  for (const g of equippedRows(player, db)) {
    const e = parseEffects(g.effects_json);
    for (const stat of TRAIN_STATS) {
      if (e[stat]) bonuses[stat] += e[stat];
    }
  }
  const edu = JSON.parse(player.education_json || '[]');
  for (const courseId of edu) {
    const c = db.prepare('SELECT bonus_json FROM education_courses WHERE id = ?').get(courseId);
    if (!c) continue;
    const b = parseEffects(c.bonus_json);
    for (const stat of TRAIN_STATS) {
      if (b[stat]) bonuses[stat] += b[stat];
    }
  }
  return bonuses;
}

export function getGearWorkerBonuses(player, db) {
  const bonuses = { manual_labor: 0, intelligence: 0, endurance: 0, technique: 0 };
  for (const g of equippedRows(player, db)) {
    const e = parseEffects(g.effects_json);
    for (const stat of WORKER_STATS) {
      if (e[stat]) bonuses[stat] += e[stat];
    }
  }
  return bonuses;
}

export function getEffectiveStats(player, db) {
  const bonuses = getGearStatBonuses(player, db);
  const classBonuses = getClassStatBonuses(player);
  const stats = {};
  for (const stat of TRAIN_STATS) {
    stats[stat] = (player[stat] ?? 10) + (bonuses[stat] || 0) + (classBonuses[stat] || 0);
  }
  stats.total = stats.strength + stats.defense + stats.speed + stats.dexterity;
  return stats;
}

export function getEffectiveWorkerStats(player, db) {
  const bonuses = getGearWorkerBonuses(player, db);
  const classBonuses = getClassStatBonuses(player);
  const stats = {};
  for (const stat of WORKER_STATS) {
    stats[stat] = (player[stat] ?? 10) + (bonuses[stat] || 0) + (classBonuses[stat] || 0);
  }
  return stats;
}

export function getGearMaxHpBonus(player, db) {
  let bonus = getClassStatBonuses(player).max_hp || 0;
  for (const g of equippedRows(player, db)) {
    const e = parseEffects(g.effects_json);
    if (e.max_hp) bonus += e.max_hp;
  }
  return bonus;
}

export function getEffectiveMaxHp(player, db) {
  return (player.max_hp ?? 100) + getGearMaxHpBonus(player, db);
}

export function syncPlayerMaxHp(db, playerId) {
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  if (!player) return;
  const effective = getEffectiveMaxHp(player, db);
  const gearBonus = getGearMaxHpBonus(player, db);
  const baseMax = Math.max(100, effective - gearBonus);
  db.prepare('UPDATE players SET max_hp = ?, hp = MIN(hp, ?) WHERE id = ?').run(
    effective,
    effective,
    playerId
  );
  return baseMax;
}

export function getCombatPower(player, db) {
  const s = getEffectiveStats(player, db);
  const b = balance.combat || {};
  return (
    s.strength * (b.strengthWeight ?? 2) +
    s.defense * (b.defenseWeight ?? 1.5) +
    s.speed * (b.speedWeight ?? 1) +
    s.dexterity * (b.dexterityWeight ?? 1) +
    player.level * (b.levelWeight ?? 5) +
    player.hp * (b.hpWeight ?? 0.5)
  );
}

/** Dexterity reduces effective mission fail chance (0–40% reduction cap). */
export function getMissionFailReduction(player, db) {
  const dex = getEffectiveStats(player, db).dexterity;
  const factor = balance.stats?.crimeDexReduction ?? 0.003;
  return Math.min(0.4, dex * factor);
}

/** Strength increases mission coin payout multiplier. */
export function getMissionCoinMultiplier(player, db) {
  const str = getEffectiveStats(player, db).strength;
  const factor = balance.stats?.crimeStrCoinBonus ?? 0.004;
  return (1 + str * factor) * getClassModifier(player, 'crimeCoinMult', 1);
}

/** Endurance reduces hospital chance on failed missions. */
export function getMissionHospitalReduction(player, db) {
  const end = getEffectiveWorkerStats(player, db).endurance;
  const factor = balance.stats?.crimeEndHospitalReduction ?? 0.002;
  return Math.min(0.35, end * factor);
}

/** Dexterity improves mug steal amount. */
export function getMugBonus(player, db) {
  const dex = getEffectiveStats(player, db).dexterity;
  const factor = balance.stats?.mugDexBonus ?? 0.005;
  return (1 + dex * factor) * getClassModifier(player, 'mugMult', 1);
}

/** Speed shaves minutes off work cooldown. */
export function getWorkCooldownReduction(player, db) {
  const spd = getEffectiveStats(player, db).speed;
  const factor = balance.stats?.workSpeedCooldown ?? 0.004;
  return Math.min(0.45, spd * factor);
}

export function formatItemEffects(effectsJson) {
  const e = parseEffects(effectsJson);
  const parts = [];
  for (const stat of [...TRAIN_STATS, ...WORKER_STATS]) {
    if (e[stat]) parts.push(`+${e[stat]} ${TRAIN_STAT_LABELS[stat]}`);
  }
  if (e.max_hp) parts.push(`+${e.max_hp} HP`);
  if (e.trainMult) parts.push(`+${Math.round((e.trainMult - 1) * 100)}% train`);
  if (e.hospitalClear) parts.push('Clears maester tent');
  if (e.jailClear) parts.push('Frees from cells');
  if (e.ceCapBonus) parts.push(`+${e.ceCapBonus} morale cap (permanent)`);
  if (e.focusCapBonus) parts.push(`+${e.focusCapBonus} focus cap (permanent)`);
  return parts.join(' · ') || 'No stat bonus';
}

export function getCharacterSheet(player, db) {
  const classInfo = getClassProgress(player);
  const classBonuses = getClassStatBonuses(player);
  const combatGear = getGearStatBonuses(player, db);
  const workerGear = getGearWorkerBonuses(player, db);
  const combatEffective = getEffectiveStats(player, db);
  const workerEffective = getEffectiveWorkerStats(player, db);
  const equipped = equippedRows(player, db).map((row) => ({
    slot: row.equip_slot,
    name: row.name,
    effects: formatItemEffects(row.effects_json)
  }));
  return {
    class: {
      current: classInfo.current,
      path: classInfo.path,
      milestone: classInfo.milestone,
      bonusSummary: formatClassBonuses(classInfo.bonuses),
      statBonuses: classBonuses
    },
    combat: {
      base: Object.fromEntries(TRAIN_STATS.map((s) => [s, player[s] ?? 10])),
      gear: combatGear,
      class: Object.fromEntries(TRAIN_STATS.map((s) => [s, classBonuses[s] || 0])),
      effective: combatEffective
    },
    worker: {
      base: Object.fromEntries(WORKER_STATS.map((s) => [s, player[s] ?? 10])),
      gear: workerGear,
      class: Object.fromEntries(WORKER_STATS.map((s) => [s, classBonuses[s] || 0])),
      effective: workerEffective
    },
    max_hp: getEffectiveMaxHp(player, db),
    hp: player.hp,
    power: Math.floor(getCombatPower(player, db)),
    equipped,
    modifiers: {
      missionFailReduction: Math.round(getMissionFailReduction(player, db) * 100),
      missionCoinBonus: Math.round((getMissionCoinMultiplier(player, db) - 1) * 100),
      mugBonus: Math.round((getMugBonus(player, db) - 1) * 100),
      workCooldownReduction: Math.round(getWorkCooldownReduction(player, db) * 100)
    },
    statEffects: STAT_EFFECTS
  };
}
