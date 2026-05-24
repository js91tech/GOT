/** v7 — PvE mob loot items (sellable materials + equippable drops). */
export function migrateExplorePve(db) {
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

  const loot = [
    ['wolf_pelt', 'Wolf Pelt', 'Sell to fur traders', 450, 'material', '{}', 1],
    ['bandit_hood', 'Bandit Hood', 'Light hood — dexterity', 0, 'gear', '{"dexterity":1}', 1],
    ['deserter_cloak', 'Deserter Cloak', 'Worn cloak — defense', 0, 'armor', '{"defense":2}', 3],
    ['smuggler_knife', 'Smuggler Knife', 'Dock alley blade', 0, 'weapon', '{"strength":2,"dexterity":1}', 6],
    ['grave_dust', 'Grave Dust', 'Alchemist reagent', 650, 'material', '{}', 10],
    ['haunted_tome', 'Haunted Tome', 'Cursed study — intelligence', 0, 'gear', '{"intelligence":2}', 12],
    ['cultist_relic', 'Cultist Relic', 'Shadow relic — sell or keep', 1200, 'material', '{}', 14],
    ['wildling_axe', 'Wildling Axe', 'Crude northern axe', 0, 'weapon', '{"strength":4}', 16],
    ['wight_shard', 'Wight Shard', 'Frozen undead fragment', 900, 'material', '{}', 15],
    ['frostbite_blade', 'Frostbite Blade', 'Ice-touched steel', 0, 'weapon', '{"strength":3,"speed":2}', 18]
  ];

  for (const row of loot) upsert.run(...row);
}
