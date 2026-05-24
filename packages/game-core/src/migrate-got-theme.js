import { ID_RENAMES } from './got-theme.js';

function ensureItemDefinition(db, fromId, toId) {
  const from = db.prepare('SELECT * FROM item_definitions WHERE id = ?').get(fromId);
  const to = db.prepare('SELECT * FROM item_definitions WHERE id = ?').get(toId);
  if (from && !to) {
    db.prepare(
      `INSERT INTO item_definitions (id, name, description, shop_price, item_type, effects_json, min_level)
       SELECT ?, name, description, shop_price, item_type, effects_json, COALESCE(min_level, 1)
       FROM item_definitions WHERE id = ?`
    ).run(toId, fromId);
    db.prepare('DELETE FROM item_definitions WHERE id = ?').run(fromId);
  } else if (from && to) {
    db.prepare('DELETE FROM item_definitions WHERE id = ?').run(fromId);
  }
}

function renameInventory(db) {
  for (const [oldId, newId] of Object.entries(ID_RENAMES)) {
    ensureItemDefinition(db, oldId, newId);
    const oldRows = db.prepare('SELECT * FROM inventory_items WHERE item_id = ?').all(oldId);
    for (const row of oldRows) {
      const dup = db
        .prepare('SELECT id, quantity FROM inventory_items WHERE player_id = ? AND item_id = ?')
        .get(row.player_id, newId);
      if (dup) {
        db.prepare('UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?').run(
          row.quantity,
          dup.id
        );
        db.prepare('DELETE FROM inventory_items WHERE id = ?').run(row.id);
      } else {
        db.prepare('UPDATE inventory_items SET item_id = ? WHERE id = ?').run(newId, row.id);
      }
    }
  }
}

function renamePlayerColumn(db, column) {
  for (const [oldId, newId] of Object.entries(ID_RENAMES)) {
    db.prepare(`UPDATE players SET ${column} = ? WHERE ${column} = ?`).run(newId, oldId);
  }
}

function renameDefinitionTable(db, table, idCol = 'id') {
  for (const [oldId, newId] of Object.entries(ID_RENAMES)) {
    const oldRow = db.prepare(`SELECT 1 FROM ${table} WHERE ${idCol} = ?`).get(oldId);
    const newRow = db.prepare(`SELECT 1 FROM ${table} WHERE ${idCol} = ?`).get(newId);
    if (oldRow && newRow) {
      db.prepare(`DELETE FROM ${table} WHERE ${idCol} = ?`).run(oldId);
      continue;
    }
    if (oldRow && !newRow) {
      try {
        db.prepare(`UPDATE ${table} SET ${idCol} = ? WHERE ${idCol} = ?`).run(newId, oldId);
      } catch {
        /* skip tables that cannot rename in place */
      }
    }
  }
}

function migrateNpcProgress(db) {
  const players = db.prepare('SELECT id, npc_progress_json FROM players').all();
  for (const p of players) {
    let progress;
    try {
      progress = JSON.parse(p.npc_progress_json || '{}');
    } catch {
      continue;
    }
    const next = {};
    let changed = false;
    for (const [key, val] of Object.entries(progress)) {
      const nk = ID_RENAMES[key] || key;
      if (nk !== key) changed = true;
      next[nk] = val;
    }
    if (changed) {
      db.prepare('UPDATE players SET npc_progress_json = ? WHERE id = ?').run(JSON.stringify(next), p.id);
    }
  }
}

function updateDefinitionNames(db) {
  const itemNames = [
    ['healers_kit', "Healer's Kit", 'Clears maester tent early'],
    ['valyrian_steel', 'Valyrian Steel Blade', '+3 strength'],
    ['grain_bundle', 'Grain Bundle', 'War camp rations x10'],
    ['iron_ingot', 'Iron Ingot', 'Forging material'],
    ['dragonglass', 'Dragonglass Shard', 'Rare forging material'],
    ['relic_chest', 'Relic Chest', 'Mystery loot'],
    ['cell_key', 'Cell Key', 'Escape the black cells instantly'],
    ['war_spear', 'War Spear', 'Piercing weapon'],
    ['plate_vest', 'Plate Vest', 'Chest protection'],
    ['sigil_charm', 'Sigil Charm', 'House technique amplifier'],
    ['smith_gloves', 'Smith Gloves', 'Worker gear'],
    ['cursed_blade', 'Valyrian Steel Blade', 'Legacy blade — reforged'],
    ['cursed_gloves', 'Smith Gloves', 'Legacy gloves'],
    ['reversal_kit', "Healer's Kit", 'Legacy kit'],
    ['spirit_spear', 'War Spear', 'Legacy spear'],
    ['armor_vest', 'Plate Vest', 'Legacy armor'],
    ['domain_charm', 'Sigil Charm', 'Legacy charm']
  ];
  for (const [id, name, desc] of itemNames) {
    db.prepare('UPDATE item_definitions SET name = ?, description = ? WHERE id = ?').run(name, desc, id);
  }

  const gyms = [
    ['training_grounds', 'Training Grounds', 'Standard castle yard'],
    ['war_yard', 'War Yard', 'High morale density training'],
    ['royal_armory', 'Royal Armory', 'Elite multiplier'],
    ['kingsguard_yard', "Kingsguard Yard", 'Speed and dex focus'],
    ['cursed_pit', 'War Yard', 'Legacy yard'],
    ['domain_chamber', 'Royal Armory', 'Legacy armory'],
    ['zenin_dojo', 'Kingsguard Yard', 'Legacy yard']
  ];
  for (const [id, name, desc] of gyms) {
    db.prepare('UPDATE gym_definitions SET name = ?, description = ? WHERE id = ?').run(name, desc, id);
  }

  const crimes = [
    ['petty_raid', 'Petty Border Raid'],
    ['petty_cleanup', 'Petty Border Raid'],
    ['border_patrol', 'Border Patrol'],
    ['grade4_patrol', 'Border Patrol'],
    ['sack_village', 'Sack the Village'],
    ['shibuya_raid', 'Sack the Village'],
    ['siege_assault', 'Siege Assault'],
    ['special_exorcism', 'Siege Assault']
  ];
  for (const [id, name] of crimes) {
    db.prepare('UPDATE crime_definitions SET name = ? WHERE id = ?').run(name, id);
  }

  const clans = [
    ['stark', 'House Stark', 'Winter is coming'],
    ['tokyo', 'House Stark', 'Winter is coming'],
    ['lannister', 'House Lannister', 'Hear me roar'],
    ['kyoto', 'House Lannister', 'Hear me roar'],
    ['baratheon', 'House Baratheon', 'Ours is the fury'],
    ['zenin', 'House Baratheon', 'Ours is the fury']
  ];
  for (const [id, name, desc] of clans) {
    db.prepare('UPDATE clans SET name = ?, description = ? WHERE id = ?').run(name, desc, id);
  }

  const education = [
    ['swordcraft', 'Swordcraft Basics'],
    ['basics', 'Swordcraft Basics'],
    ['critical_strike', 'Critical Strike Theory'],
    ['black_flash', 'Critical Strike Theory'],
    ['siegecraft', 'Siegecraft'],
    ['domain_theory', 'Siegecraft']
  ];
  for (const [id, name] of education) {
    db.prepare('UPDATE education_courses SET name = ? WHERE id = ?').run(name, id);
  }

  const commodities = [
    ['grain_sack', 'Grain Sack'],
    ['cursed_rice', 'Grain Sack'],
    ['dragonglass_dust', 'Dragonglass Dust'],
    ['spirit_amber', 'Dragonglass Dust'],
    ['noble_seal', 'Noble Seal'],
    ['grade_bead', 'Noble Seal']
  ];
  for (const [id, name] of commodities) {
    db.prepare('UPDATE commodities SET name = ? WHERE id = ?').run(name, id);
  }

  const drugs = [
    ['morale_tonic', 'Morale Tonic', 'Restore 40 morale'],
    ['ce_shot', 'Morale Tonic', 'Restore 40 morale']
  ];
  for (const [id, name, desc] of drugs) {
    db.prepare('UPDATE drug_definitions SET name = ?, description = ? WHERE id = ?').run(name, desc, id);
  }

  const companies = [
    ["kings_guard", "King's Guard"],
    ['jujutsu_ops', "King's Guard"],
    ['coin_masters', 'Coin Masters Guild'],
    ['cursed_logistics', 'Coin Masters Guild'],
    ['river_patrol', 'Riverlands Patrol'],
    ['shibuya_response', 'Riverlands Patrol'],
    ['vault_security', 'Vault Security Corp']
  ];
  for (const [id, name] of companies) {
    db.prepare('UPDATE company_definitions SET name = ? WHERE id = ?').run(name, id);
  }

  const estates = [
    [1, 'Squire Quarters'],
    [2, 'Lordly Chambers'],
    [3, 'Safe House'],
    [4, 'Dragonstone Keep']
  ];
  for (const [tier, name] of estates) {
    db.prepare('UPDATE estate_tiers SET name = ? WHERE tier = ?').run(name, tier);
  }

  const jobs = [
    ['stable_hand', 'Stable Hand'],
    ['squire_duty', 'Squire'],
    ['relic_keeper', 'Relic Keeper'],
    ['janitor', 'Stable Hand'],
    ['instructor_assistant', 'Squire'],
    ['curator', 'Relic Keeper']
  ];
  for (const [id, name] of jobs) {
    db.prepare('UPDATE job_definitions SET name = ? WHERE id = ?').run(name, id);
  }
}

export function refreshGotLabels(db) {
  updateDefinitionNames(db);
}

/** Migrate existing saves from legacy ids to Westeros ids (v5). */
export function migrateGotTheme(db) {
  db.pragma('foreign_keys = OFF');
  try {
    for (const [oldId, newId] of Object.entries(ID_RENAMES)) {
      ensureItemDefinition(db, oldId, newId);
    }
    renameInventory(db);
    for (const table of [
      'item_definitions',
      'gym_definitions',
      'company_definitions',
      'crime_definitions',
      'clans',
      'education_courses',
      'commodities',
      'drug_definitions',
      'forge_recipes',
      'job_definitions'
    ]) {
      renameDefinitionTable(db, table);
    }
    for (const col of ['gym_id', 'company_id', 'clan_id', 'explore_area', 'world_id', 'job_id']) {
      renamePlayerColumn(db, col);
    }
    db.prepare("UPDATE players SET explore_room = 'great_hall' WHERE explore_room = 'courtyard'").run();
    db.prepare("UPDATE players SET username = 'Lord' WHERE username = 'Sorcerer'").run();
    migrateNpcProgress(db);
    updateDefinitionNames(db);
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
