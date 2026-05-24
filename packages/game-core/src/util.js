import balance from './balance.json' with { type: 'json' };
import { lordRank } from './got-theme.js';
import { getClassXpMultiplier } from './classes.js';

export { balance };

export function maxLevel() {
  return balance.maxLevel ?? 50;
}

export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.45));
}

/** Reduce XP rewards as level approaches cap (50). */
export function scaleXp(baseXp, playerLevel) {
  const cap = maxLevel();
  const lv = Math.min(Math.max(1, playerLevel), cap);
  const floor = balance.xpScaleFloor ?? 0.22;
  const factor = Math.max(floor, 1.12 - lv / cap);
  return Math.max(1, Math.floor(baseXp * factor));
}

/** Level-scaled XP with class path multipliers. */
export function computeScaledXp(baseXp, player, context = 'general') {
  let xp = scaleXp(baseXp, player.level);
  xp = Math.floor(xp * getClassXpMultiplier(player, context));
  return Math.max(1, xp);
}

export function gradeName(level) {
  return lordRank(level);
}

/** Clear level-gate feedback for Discord and web. */
export function requireLevel(player, requiredLevel, featureName) {
  if (player.level >= requiredLevel) return { ok: true };
  const gap = requiredLevel - player.level;
  return {
    ok: false,
    message:
      `**${featureName}** needs **Level ${requiredLevel}** (${gradeName(requiredLevel)}). ` +
      `You are **Lv.${player.level}** (${gradeName(player.level)}) — **${gap}** more level(s) to go. ` +
      `Train with \`/train\`, run missions with \`/crime\`, or \`/work\` for XP.`
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseIso(iso) {
  return iso ? new Date(iso) : null;
}

export function minutesFromNow(mins) {
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

export function isBlocked(player) {
  const now = Date.now();
  if (player.hospital_until && new Date(player.hospital_until).getTime() > now) {
    return { blocked: true, reason: 'hospital', until: player.hospital_until };
  }
  if (player.jail_until && new Date(player.jail_until).getTime() > now) {
    return { blocked: true, reason: 'jail', until: player.jail_until };
  }
  return { blocked: false };
}

export function canAttack(attacker, defender) {
  if (attacker.id === defender.id) return { ok: false, message: 'You cannot target yourself.' };
  if (defender.level < balance.gradeProtectionLevel && attacker.level - defender.level > balance.gradeProtectionGap) {
    return { ok: false, message: `${defender.username} has ward protection (under level ${balance.gradeProtectionLevel}).` };
  }
  if (attacker.level < balance.gradeProtectionLevel && defender.level - attacker.level > balance.gradeProtectionGap) {
    return { ok: false, message: 'They are too strong for you while you have ward protection.' };
  }
  const dBlock = isBlocked(defender);
  if (dBlock.blocked && dBlock.reason === 'hospital') {
    return { ok: false, message: 'Target is in the maester\'s tent.' };
  }
  return { ok: true };
}

export function roll(chance) {
  return Math.random() < chance;
}

export function audit(db, playerId, kind, amount, meta = {}) {
  db.prepare(
    `INSERT INTO transactions (player_id, kind, amount, meta_json) VALUES (?, ?, ?, ?)`
  ).run(playerId, kind, amount, JSON.stringify(meta));
  import('./daily-quests.js')
    .then(({ bumpDailyQuestFromAudit }) => bumpDailyQuestFromAudit(db, playerId, kind))
    .catch(() => {});
}

export function getCritChance(player, db) {
  let chance = 0.08;
  const edu = JSON.parse(player.education_json || '[]');
  for (const courseId of edu) {
    const c = db.prepare('SELECT bonus_json FROM education_courses WHERE id = ?').get(courseId);
    if (c) {
      const b = JSON.parse(c.bonus_json);
      if (b.critBonus) chance += b.critBonus;
    }
  }
  return chance;
}

export function getTrainMultiplier(player, db) {
  let mult = 1;
  const gym = db.prepare('SELECT train_multiplier FROM gym_definitions WHERE id = ?').get(
    player.gym_id || 'training_grounds'
  );
  if (gym) mult *= gym.train_multiplier;
  const estate = db.prepare('SELECT train_multiplier FROM estate_tiers WHERE tier = ?').get(player.estate_tier);
  if (estate) mult *= estate.train_multiplier;
  const edu = JSON.parse(player.education_json || '[]');
  for (const courseId of edu) {
    const c = db.prepare('SELECT bonus_json FROM education_courses WHERE id = ?').get(courseId);
    if (c) {
      const b = JSON.parse(c.bonus_json);
      if (b.trainMult) mult *= b.trainMult;
    }
  }
  const gear = db
    .prepare(
      `SELECT i.effects_json FROM inventory_items inv
       JOIN item_definitions i ON i.id = inv.item_id
       WHERE inv.player_id = ? AND inv.equip_slot IS NOT NULL`
    )
    .all(player.id);
  for (const g of gear) {
    const e = JSON.parse(g.effects_json);
    if (e.trainMult) mult *= e.trainMult;
  }
  return mult;
}

export function applyLevelUps(db, player) {
  const cap = maxLevel();
  let level = player.level;
  let xp = player.xp;
  let leveled = 0;
  while (level < cap && xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    leveled += 1;
  }
  if (level >= cap) {
    xp = Math.min(xp, xpForLevel(cap) - 1);
    level = cap;
  }
  if (leveled > 0) {
    const maxHp = 100 + (level - 1) * 5;
    db.prepare(
      `UPDATE players SET level = ?, xp = ?, max_hp = ?, hp = MIN(hp + ?, max_hp),
       strength = strength + ?, defense = defense + ?, speed = speed + ?, dexterity = dexterity + ?
       WHERE id = ?`
    ).run(level, xp, maxHp, leveled * 10, leveled, leveled, leveled, leveled, player.id);
    audit(db, player.id, 'level_up', leveled, { newLevel: level });
  } else if (xp !== player.xp) {
    db.prepare('UPDATE players SET xp = ? WHERE id = ?').run(xp, player.id);
  }
  return leveled;
}
