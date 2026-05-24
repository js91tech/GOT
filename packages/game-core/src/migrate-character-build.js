/** v6 — armory shop items, min_level on gear, character build support. */
export function migrateCharacterBuild(db) {
  try {
    db.exec('ALTER TABLE item_definitions ADD COLUMN min_level INTEGER NOT NULL DEFAULT 1');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
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

  const armory = [
    ['rusty_blade', 'Rusty Blade', 'A worn blade for new recruits', 1500, 'weapon', '{"strength":1}', 1],
    ['hunting_knife', 'Hunting Knife', 'Light blade — strength and finesse', 3200, 'weapon', '{"strength":1,"dexterity":1}', 3],
    ['iron_longsword', 'Iron Longsword', 'Reliable castle steel', 4500, 'weapon', '{"strength":2}', 5],
    ['valyrian_steel', 'Valyrian Steel Blade', 'Legendary folded steel', 8000, 'weapon', '{"strength":3}', 10],
    ['war_spear', 'War Spear', 'Reach weapon for cavalry lines', 22000, 'weapon', '{"strength":5,"speed":2}', 20],
    ['leather_jerkin', 'Leather Jerkin', 'Basic padded armor', 1200, 'armor', '{"defense":2,"max_hp":5}', 1],
    ['round_shield', 'Round Shield', 'Wood and iron shield', 3500, 'armor', '{"defense":2,"speed":1}', 4],
    ['chain_hauberk', 'Chain Hauberk', 'Linked mail over gambeson', 5500, 'armor', '{"defense":3,"max_hp":10}', 8],
    ['plate_vest', 'Plate Vest', 'Heavy chest plate', 16000, 'armor', '{"defense":4,"max_hp":15}', 15],
    ['tower_shield', 'Tower Shield', 'Massive defensive wall', 9000, 'armor', '{"defense":5,"max_hp":8}', 12],
    ['training_weights', 'Training Weights', '+5% train gains', 2500, 'gear', '{"trainMult":1.05}', 1],
    ['smith_gloves', 'Smith Gloves', 'Forge-hardened gloves', 3500, 'gear', '{"manual_labor":3}', 5],
    ['scholar_tome', 'Scholar Tome', 'Maester study aid', 4000, 'gear', '{"intelligence":3}', 5],
    ['sigil_charm', 'Sigil Charm', 'House sigil technique amplifier', 28000, 'gear', '{"trainMult":1.08,"dexterity":2}', 18]
  ];

  for (const row of armory) {
    upsert.run(...row);
  }
}
