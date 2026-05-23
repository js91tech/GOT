/** SoL-style trainable combat stats (Samurai of Legend). */
export const TRAIN_STATS = ['strength', 'defense', 'speed', 'dexterity'];

export const TRAIN_STAT_LABELS = {
  strength: 'Strength',
  defense: 'Defense',
  speed: 'Speed',
  dexterity: 'Dexterity'
};

export function normalizeTrainStat(stat) {
  const key = String(stat || 'strength').toLowerCase();
  return TRAIN_STATS.includes(key) ? key : 'strength';
}

export function getGearStatBonuses(player, db) {
  const bonuses = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
  const gear = db
    .prepare(
      `SELECT i.effects_json FROM inventory_items inv
       JOIN item_definitions i ON i.id = inv.item_id
       WHERE inv.player_id = ? AND inv.equip_slot IS NOT NULL`
    )
    .all(player.id);
  for (const g of gear) {
    const e = JSON.parse(g.effects_json || '{}');
    for (const stat of TRAIN_STATS) {
      if (e[stat]) bonuses[stat] += e[stat];
    }
  }
  const edu = JSON.parse(player.education_json || '[]');
  for (const courseId of edu) {
    const c = db.prepare('SELECT bonus_json FROM education_courses WHERE id = ?').get(courseId);
    if (!c) continue;
    const b = JSON.parse(c.bonus_json || '{}');
    for (const stat of TRAIN_STATS) {
      if (b[stat]) bonuses[stat] += b[stat];
    }
  }
  return bonuses;
}

export function getEffectiveStats(player, db) {
  const bonuses = getGearStatBonuses(player, db);
  const stats = {};
  for (const stat of TRAIN_STATS) {
    stats[stat] = (player[stat] ?? 10) + (bonuses[stat] || 0);
  }
  stats.total = stats.strength + stats.defense + stats.speed + stats.dexterity;
  return stats;
}

/** Combat rating used for PvP (all trainable stats matter). */
export function getCombatPower(player, db) {
  const s = getEffectiveStats(player, db);
  return (
    s.strength * 2 +
    s.defense * 1.5 +
    s.speed +
    s.dexterity +
    player.level * 5 +
    player.hp * 0.5
  );
}
