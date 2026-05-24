import { ID_RENAMES } from './got-theme.js';

function renamePlayerColumn(db, column) {
  for (const [oldId, newId] of Object.entries(ID_RENAMES)) {
    db.prepare(`UPDATE players SET ${column} = ? WHERE ${column} = ?`).run(newId, oldId);
  }
}

function renameInventory(db) {
  for (const [oldId, newId] of Object.entries(ID_RENAMES)) {
    db.prepare('UPDATE inventory_items SET item_id = ? WHERE item_id = ?').run(newId, oldId);
  }
}

function renameDefinitionTable(db, table, idCol = 'id') {
  for (const [oldId, newId] of Object.entries(ID_RENAMES)) {
    const exists = db.prepare(`SELECT 1 FROM ${table} WHERE ${idCol} = ?`).get(newId);
    if (exists) continue;
    try {
      db.prepare(`UPDATE ${table} SET ${idCol} = ? WHERE ${idCol} = ?`).run(newId, oldId);
    } catch {
      /* skip */
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
    ['smith_gloves', 'Smith Gloves', 'Worker gear']
  ];
  for (const [id, name, desc] of itemNames) {
    db.prepare('UPDATE item_definitions SET name = ?, description = ? WHERE id = ?').run(name, desc, id);
  }
  const gyms = [
    ['training_grounds', 'Training Grounds', 'Standard castle yard'],
    ['war_yard', 'War Yard', 'High morale density training'],
    ['royal_armory', 'Royal Armory', 'Elite multiplier'],
    ['kingsguard_yard', "Kingsguard Yard", 'Speed and dex focus']
  ];
  for (const [id, name, desc] of gyms) {
    db.prepare('UPDATE gym_definitions SET name = ?, description = ? WHERE id = ?').run(name, desc, id);
  }
}

/** Migrate existing saves from JJK ids to Westeros ids (v5). */
export function migrateGotTheme(db) {
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
}
