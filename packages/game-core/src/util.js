import balance from './balance.json' with { type: 'json' };

export { balance };

export function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function gradeName(level) {
  if (level >= 80) return 'Special Grade';
  if (level >= 50) return 'Grade 1';
  if (level >= 30) return 'Grade 2';
  if (level >= 15) return 'Grade 3';
  return 'Grade 4';
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
    return { ok: false, message: `${defender.username} has Grade protection (under level ${balance.gradeProtectionLevel}).` };
  }
  if (attacker.level < balance.gradeProtectionLevel && defender.level - attacker.level > balance.gradeProtectionGap) {
    return { ok: false, message: 'They are too strong for you while you have Grade protection.' };
  }
  const dBlock = isBlocked(defender);
  if (dBlock.blocked && dBlock.reason === 'hospital') {
    return { ok: false, message: 'Target is in Shoko\'s infirmary.' };
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
  let level = player.level;
  let xp = player.xp;
  let leveled = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    leveled += 1;
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
