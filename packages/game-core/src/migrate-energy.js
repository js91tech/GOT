/** Player morale/focus cap bonus columns + shop relics. */
export function migrateEnergyCaps(db) {
  for (const [col, def] of [
    ['ce_cap_bonus', 'INTEGER NOT NULL DEFAULT 0'],
    ['focus_cap_bonus', 'INTEGER NOT NULL DEFAULT 0']
  ]) {
    try {
      db.exec(`ALTER TABLE players ADD COLUMN ${col} ${def}`);
    } catch (e) {
      if (!String(e.message).includes('duplicate column')) throw e;
    }
  }

  const upsert = db.prepare(
    `INSERT INTO item_definitions (id, name, description, shop_price, item_type, effects_json, min_level)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       shop_price = excluded.shop_price,
       item_type = excluded.item_type,
       effects_json = excluded.effects_json,
       min_level = excluded.min_level`
  );
  upsert.run(
    'battlehorn_relic',
    'Battlehorn of the Warlord',
    'Permanent +25 morale regen cap and overflow (125 / 225). One per lord.',
    480000,
    'upgrade',
    '{"ceCapBonus":25}',
    12
  );
  upsert.run(
    'focus_crown_relic',
    "Maester's Focus Crown",
    'Permanent +25 focus regen cap and overflow (125 / 225). One per lord.',
    480000,
    'upgrade',
    '{"focusCapBonus":25}',
    12
  );
}
