/** Idempotent schema + seed repairs (runs every boot before versioned migrations). */
export function ensureSchemaPatches(db) {
  try {
    db.exec('ALTER TABLE item_definitions ADD COLUMN min_level INTEGER NOT NULL DEFAULT 1');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec("ALTER TABLE players ADD COLUMN pve_encounter_json TEXT NOT NULL DEFAULT ''");
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec("ALTER TABLE players ADD COLUMN class_id TEXT NOT NULL DEFAULT 'squire'");
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE players ADD COLUMN ce_cap_bonus INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE players ADD COLUMN focus_cap_bonus INTEGER NOT NULL DEFAULT 0');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }

  // v13 columns (idempotent — fixes partial failed migrations on production)
  try {
    db.exec('ALTER TABLE players ADD COLUMN focus_updated_at TEXT');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE players ADD COLUMN daily_quest_date TEXT');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE players ADD COLUMN daily_quest_state_json TEXT');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE players ADD COLUMN investment_return_mult REAL');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.prepare(
      `UPDATE players SET focus_updated_at = energy_updated_at
       WHERE focus_updated_at IS NULL OR focus_updated_at = ''`
    ).run();
    db.prepare(
      `UPDATE players SET daily_quest_state_json = '{}'
       WHERE daily_quest_state_json IS NULL OR daily_quest_state_json = ''`
    ).run();
  } catch {
    /* players table may not exist yet on fresh install before migrate */
  }

  const upsertItem = db.prepare(
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

  const materials = [
    ['grain_sack', 'Grain Sack', 'Harvested grain', 100, 'material', '{}'],
    ['timber_shard', 'Timber Bundle', 'Building timber', 800, 'material', '{}'],
    ['gold_dust', 'Gold Dust', 'Refined gold dust', 2000, 'material', '{}'],
    ['noble_seal', 'Noble Seal', 'Signet of office', 2500, 'material', '{}'],
    ['dragonglass_dust', 'Dragonglass Dust', 'Obsidian powder', 500, 'material', '{}'],
    ['rusty_blade', 'Rusty Blade', 'Recruit blade', 1500, 'weapon', '{"strength":1}'],
    ['hunting_knife', 'Hunting Knife', 'Light blade', 3200, 'weapon', '{"strength":1,"dexterity":1}'],
    ['leather_jerkin', 'Leather Jerkin', 'Padded armor', 1200, 'armor', '{"defense":2,"max_hp":5}'],
    ['round_shield', 'Round Shield', 'Wood and iron shield', 3500, 'armor', '{"defense":2,"speed":1}'],
    ['chain_hauberk', 'Chain Hauberk', 'Linked mail', 5500, 'armor', '{"defense":3,"max_hp":10}'],
    ['iron_longsword', 'Iron Longsword', 'Castle steel', 4500, 'weapon', '{"strength":2}'],
    ['morale_tonic', 'Morale Tonic', 'Restore morale', 500, 'consumable', '{"ce":40}']
  ];
  for (const row of materials) upsertItem.run(...row, 1);

  const legacyItems = [
    ['cursed_blade', 'Valyrian Steel Blade', 'Legacy blade', 8000, 'weapon', '{"strength":3}'],
    ['cursed_gloves', 'Smith Gloves', 'Legacy gloves', 3500, 'gear', '{"manual_labor":3}'],
    ['reversal_kit', "Healer's Kit", 'Legacy kit', 500, 'consumable', '{"hospitalClear":true}'],
    ['spirit_spear', 'War Spear', 'Legacy spear', 0, 'weapon', '{"strength":5,"speed":2}'],
    ['domain_charm', 'Sigil Charm', 'Legacy charm', 0, 'gear', '{"trainMult":1.08,"dexterity":2}'],
    ['armor_vest', 'Plate Vest', 'Legacy armor', 0, 'armor', '{"defense":4,"max_hp":15}'],
    ['rice_bundle', 'Grain Bundle', 'Legacy rations', 200, 'material', '{}'],
    ['iron_ore', 'Iron Ingot', 'Legacy ore', 1500, 'material', '{}'],
    ['spirit_core', 'Dragonglass Shard', 'Legacy shard', 5000, 'material', '{}'],
    ['grab_bag', 'Relic Chest', 'Legacy chest', 50000, 'consumable', '{}'],
    ['prison_key', 'Cell Key', 'Legacy key', 12000, 'consumable', '{"jailClear":true}']
  ];
  for (const row of legacyItems) upsertItem.run(...row, 1);

  upsertItem.run(
    'battlehorn_relic',
    'Battlehorn of the Warlord',
    'Permanent +25 morale regen & overflow cap',
    480000,
    'upgrade',
    '{"ceCapBonus":25}',
    12
  );
  upsertItem.run(
    'focus_crown_relic',
    "Maester's Focus Crown",
    'Permanent +25 focus regen & overflow cap',
    480000,
    'upgrade',
    '{"focusCapBonus":25}',
    12
  );

  db.exec('DELETE FROM inventory_items WHERE item_id NOT IN (SELECT id FROM item_definitions)');
  db.exec('DELETE FROM market_listings WHERE item_id NOT IN (SELECT id FROM item_definitions)');
}
