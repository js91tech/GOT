import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL } from './schema.js';
import { migrateGotTheme } from './migrate-got-theme.js';
import { migrateCharacterBuild } from './migrate-character-build.js';
import { migrateExplorePve } from './migrate-explore-pve.js';
import { migratePveEncounter } from './migrate-pve-encounter.js';
import { ensureSchemaPatches } from './migrate-repair.js';
import { refreshGotLabels } from './migrate-got-theme.js';
import { migrateClasses } from './migrate-classes.js';
import { migrateEnergyCaps } from './migrate-energy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dbInstance = null;
let bootLogged = false;

export function getDbPath() {
  return process.env.DATABASE_PATH || path.resolve(__dirname, '../../../data/westeros.db');
}

/** Log once at startup — compare bot vs web logs; paths/sizes must match for shared saves. */
export function logDatabaseBoot(service = process.env.SERVICE || 'app') {
  if (bootLogged) return;
  bootLogged = true;
  const dbPath = path.resolve(getDbPath());
  const dataDir = '/data';
  const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_NAME);
  let size = 0;
  let exists = false;
  try {
    exists = fs.existsSync(dbPath);
    if (exists) size = fs.statSync(dbPath).size;
  } catch {
    /* ignore */
  }
  console.log(`[westeros-db] service=${service} path=${dbPath} exists=${exists} size=${size}`);
  if (onRailway) {
    const dataMounted = fs.existsSync(dataDir);
    console.log(`[westeros-db] /data mounted=${dataMounted}`);
    if (!dataMounted) {
      console.warn(
        '[westeros-db] WARNING: No /data volume — bot/web/api will each use separate ephemeral saves. Attach ONE shared volume at /data on every service.'
      );
    } else if (!dbPath.startsWith(`${dataDir}${path.sep}`)) {
      console.warn(`[westeros-db] WARNING: DATABASE_PATH should be /data/westeros.db on Railway (got ${dbPath})`);
    }
  }
}

export function getDb() {
  if (!dbInstance) {
    logDatabaseBoot();
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    migrate(dbInstance);
  }
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function migrate(db) {
  db.exec(SCHEMA_SQL);
  ensureSchemaPatches(db);
  const version = db.pragma('user_version', { simple: true });
  if (version < 1) {
    seedWorld(db);
    db.pragma('user_version = 1');
  }
  if (version < 2) {
    for (const [col, def] of [
      ['defense', 'INTEGER NOT NULL DEFAULT 10'],
      ['speed', 'INTEGER NOT NULL DEFAULT 10'],
      ['dexterity', 'INTEGER NOT NULL DEFAULT 10']
    ]) {
      try {
        db.exec(`ALTER TABLE players ADD COLUMN ${col} ${def}`);
      } catch (e) {
        if (!String(e.message).includes('duplicate column')) throw e;
      }
    }
    db.pragma('user_version = 2');
  }
  if (version < 3) {
    const cols = [
      ['manual_labor', 'INTEGER NOT NULL DEFAULT 10'],
      ['intelligence', 'INTEGER NOT NULL DEFAULT 10'],
      ['endurance', 'INTEGER NOT NULL DEFAULT 10'],
      ['technique', 'INTEGER NOT NULL DEFAULT 10'],
      ['gym_id', "TEXT NOT NULL DEFAULT 'training_grounds'"],
      ['company_id', 'TEXT'],
      ['explore_area', "TEXT NOT NULL DEFAULT 'winterfell'"],
      ['explore_room', "TEXT NOT NULL DEFAULT 'great_hall'"],
      ['npc_progress_json', "TEXT NOT NULL DEFAULT '{}'"],
      ['drug_cooldowns_json', "TEXT NOT NULL DEFAULT '{}'"]
    ];
    for (const [col, def] of cols) {
      try {
        db.exec(`ALTER TABLE players ADD COLUMN ${col} ${def}`);
      } catch (e) {
        if (!String(e.message).includes('duplicate column')) throw e;
      }
    }
    try {
      db.exec('ALTER TABLE inventory_items ADD COLUMN equip_slot TEXT');
    } catch (e) {
      if (!String(e.message).includes('duplicate column')) throw e;
    }
    seedPhase4(db);
    db.pragma('user_version = 3');
  }
  if (version < 4) {
    for (const [col, def] of [
      ['faction_id', 'TEXT'],
      ['guild_id', 'INTEGER']
    ]) {
      try {
        db.exec(`ALTER TABLE players ADD COLUMN ${col} ${def}`);
      } catch (e) {
        if (!String(e.message).includes('duplicate column')) throw e;
      }
    }
    seedWesterosRealm(db);
    db.pragma('user_version = 4');
  }
  if (version < 5) {
    migrateGotTheme(db);
    db.pragma('user_version = 5');
  }
  if (version < 6) {
    migrateCharacterBuild(db);
    db.pragma('user_version = 6');
  }
  if (version < 7) {
    migrateExplorePve(db);
    db.pragma('user_version = 7');
  }
  if (version < 8) {
    migratePveEncounter(db);
    db.pragma('user_version = 8');
  }
  if (version < 9) {
    refreshGotLabels(db);
    db.pragma('user_version = 9');
  }
  if (version < 10) {
    migrateClasses(db);
    db.pragma('user_version = 10');
  }
  if (version < 11) {
    migrateEnergyCaps(db);
    db.pragma('user_version = 11');
  }
  ensureSchemaPatches(db);
}

function seedWesterosRealm(db) {
  const dataDir = path.join(__dirname, '../data');
  const factions = JSON.parse(fs.readFileSync(path.join(dataDir, 'factions.json'), 'utf8'));
  const insFaction = db.prepare(
    `INSERT OR IGNORE INTO factions (id, name, motto, crest_key, bonus_json) VALUES (?, ?, ?, ?, ?)`
  );
  for (const f of factions) {
    insFaction.run(f.id, f.name, f.motto, f.crest_key, JSON.stringify(f.bonus_json || {}));
  }
  const territories = JSON.parse(fs.readFileSync(path.join(dataDir, 'territories.json'), 'utf8'));
  const insTerritory = db.prepare(
    `INSERT OR IGNORE INTO territories
     (id, name, display_name, svg_path_id, map_x, map_y, default_faction_id, resource_type, base_yield_per_hour, neighbors_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insControl = db.prepare(
    `INSERT OR IGNORE INTO territory_control (territory_id, owner_type, owner_id, garrison_power, tax_rate)
     VALUES (?, 'faction', ?, 25, 0.15)`
  );
  for (const t of territories) {
    insTerritory.run(
      t.id,
      t.name,
      t.display_name,
      t.svg_path_id,
      t.map_x,
      t.map_y,
      t.default_faction_id,
      t.resource_type,
      t.base_yield_per_hour,
      JSON.stringify(t.neighbors || [])
    );
    if (t.default_faction_id) {
      insControl.run(t.id, t.default_faction_id);
    }
  }
}

function seedPhase4(db) {
  const gyms = [
    ['training_grounds', 'Training Grounds', 'Standard castle yard', 1.0, 1, 0],
    ['war_yard', 'War Yard', 'High morale density training', 1.15, 5, 25000],
    ['royal_armory', 'Royal Armory', 'Elite multiplier', 1.3, 20, 250000],
    ['kingsguard_yard', "Kingsguard Yard", 'Speed and dex focus', 1.2, 12, 100000]
  ];
  const insGym = db.prepare(
    `INSERT OR IGNORE INTO gym_definitions (id, name, description, train_multiplier, min_level, unlock_cost) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of gyms) insGym.run(...r);

  const companies = [
    ['kings_guard', "King's Guard", 'manual_labor', 300, 100, 1.25, 1],
    ['coin_masters', 'Coin Masters Guild', 'intelligence', 400, 120, 1.3, 5],
    ['river_patrol', 'Riverlands Patrol', 'endurance', 500, 140, 1.35, 10],
    ['vault_security', 'Vault Security Corp', 'technique', 600, 160, 1.4, 18]
  ];
  const insCo = db.prepare(
    `INSERT OR IGNORE INTO company_definitions (id, name, worker_stat, base_coins, base_xp, payout_mult, min_level) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const r of companies) insCo.run(...r);

  const drugs = [
    ['morale_tonic', 'Morale Tonic', 'Restore 40 morale', 500, 45, '{"ce":40}'],
    ['focus_tea', 'Focus Tea', '+30 Focus', 350, 30, '{"focus":30}'],
    ['resolve_pill', 'Resolve Pill', '+25 Resolve and Bravery', 400, 60, '{"resolve":25,"bravery":25}'],
    ['booster_serum', 'Booster Serum', '+2 all combat stats', 2500, 180, '{"strength":2,"defense":2,"speed":2,"dexterity":2}']
  ];
  const insDrug = db.prepare(
    `INSERT OR IGNORE INTO drug_definitions (id, name, description, cost, cooldown_minutes, effects_json) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of drugs) insDrug.run(...r);

  const recipes = [
    ['valyrian_steel', 'Valyrian Steel', 'valyrian_steel', '{"iron_ingot":2,"dragonglass":1}', 10000, 50],
    ['war_spear', 'War Spear', 'war_spear', '{"iron_ingot":5,"dragonglass":2}', 25000, 100],
    ['plate_vest', 'Plate Vest', 'plate_vest', '{"iron_ingot":4}', 8000, 40],
    ['sigil_charm', 'Sigil Charm', 'sigil_charm', '{"dragonglass":3,"noble_seal":1}', 100000, 200]
  ];
  const insRec = db.prepare(
    `INSERT OR IGNORE INTO forge_recipes (id, name, output_item, materials_json, coin_cost, ce_cost) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of recipes) insRec.run(...r);

  const extraItems = [
    ['war_spear', 'War Spear', 'Piercing weapon', 0, 'weapon', '{"strength":5,"speed":2}'],
    ['plate_vest', 'Plate Vest', 'Chest protection', 0, 'armor', '{"defense":4,"max_hp":15}'],
    ['sigil_charm', 'Sigil Charm', 'Technique amplifier', 0, 'gear', '{"trainMult":1.08,"dexterity":2}'],
    ['smith_gloves', 'Smith Gloves', 'Worker gear', 3500, 'gear', '{"manual_labor":3}'],
    ['scholar_tome', 'Scholar Tome', 'Study aid', 4000, 'gear', '{"intelligence":3}']
  ];
  const insItem = db.prepare(
    `INSERT OR IGNORE INTO item_definitions (id, name, description, shop_price, item_type, effects_json) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of extraItems) insItem.run(...r);
  insItem.run('cell_key', 'Cell Key', 'Escape the black cells instantly', 12000, 'consumable', '{"jailClear":true}');
}

function seedWorld(db) {
  const items = [
    ['healers_kit', "Healer's Kit", 'Clears maester tent early', 500, 'consumable', '{"hospitalClear":true}'],
    ['training_weights', 'Training Weights', '+5% train gains', 2500, 'gear', '{"trainMult":1.05}'],
    ['valyrian_steel', 'Valyrian Steel Blade', '+3 strength', 8000, 'weapon', '{"strength":3}'],
    ['grain_bundle', 'Grain Bundle', 'War camp rations x10', 200, 'material', '{"rice":10}'],
    ['iron_ingot', 'Iron Ingot', 'Forging material', 1500, 'material', '{"forge":true}'],
    ['dragonglass', 'Dragonglass Shard', 'Rare forging material', 5000, 'material', '{"forge":true}'],
    ['relic_chest', 'Relic Chest', 'Mystery loot', 50000, 'consumable', '{"grabBag":true}'],
    ['cell_key', 'Cell Key', 'Escape the black cells instantly', 12000, 'consumable', '{"jailClear":true}'],
    ['timber_shard', 'Timber Bundle', 'Building material', 800, 'material', '{}'],
    ['gold_dust', 'Gold Dust', 'Refined gold dust', 2000, 'material', '{}']
  ];
  const insItem = db.prepare(
    `INSERT OR IGNORE INTO item_definitions (id, name, description, shop_price, item_type, effects_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const row of items) insItem.run(...row);

  const crimes = [
    ['petty_raid', 'Petty Border Raid', 1, 5, 29, 50, 0.05, 0.02, 0.01],
    ['border_patrol', 'Border Patrol', 5, 15, 45, 120, 0.12, 0.08, 0.05],
    ['sack_village', 'Sack the Village', 15, 30, 80, 400, 0.2, 0.15, 0.1],
    ['siege_assault', 'Siege Assault', 30, 50, 150, 1200, 0.35, 0.25, 0.18]
  ];
  const insCrime = db.prepare(
    `INSERT OR IGNORE INTO crime_definitions
     (id, name, min_level, bravery_cost, xp_reward, coin_reward, fail_chance, jail_chance, hospital_chance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of crimes) insCrime.run(...row);

  const jobs = [
    ['janitor', 'Stable Hand', 100, 50, 1],
    ['instructor_assistant', 'Squire', 500, 200, 5],
    ['curator', 'Relic Keeper', 2000, 800, 15]
  ];
  const insJob = db.prepare(
    `INSERT OR IGNORE INTO job_definitions (id, name, coin_payout, xp_payout, min_level) VALUES (?, ?, ?, ?, ?)`
  );
  for (const row of jobs) insJob.run(...row);

  const clans = [
    ['stark', 'House Stark', 'Winter is coming'],
    ['lannister', 'House Lannister', 'Hear me roar'],
    ['baratheon', 'House Baratheon', 'Ours is the fury']
  ];
  const insClan = db.prepare(
    `INSERT OR IGNORE INTO clans (id, name, description, bank_balance) VALUES (?, ?, ?, 0)`
  );
  for (const row of clans) insClan.run(...row);

  const estates = [
    [0, 'None', 0, 1.0],
    [1, 'Dorm Room', 50000, 1.05],
    [2, 'Faculty Quarters', 500000, 1.12],
    [3, 'Safe House', 5000000, 1.25],
    [4, 'Dragonstone Keep', 50000000, 1.4]
  ];
  const insEstate = db.prepare(
    `INSERT OR IGNORE INTO estate_tiers (tier, name, cost, train_multiplier) VALUES (?, ?, ?, ?)`
  );
  for (const row of estates) insEstate.run(...row);

  const education = [
    ['swordcraft', 'Swordcraft Basics', 0, 1000, '{"trainMult":1.02}'],
    ['critical_strike', 'Critical Strike Theory', 10, 50000, '{"critBonus":0.05}'],
    ['siegecraft', 'Siegecraft', 25, 500000, '{"strength":2}']
  ];
  const insEdu = db.prepare(
    `INSERT OR IGNORE INTO education_courses (id, name, min_level, cost, bonus_json) VALUES (?, ?, ?, ?, ?)`
  );
  for (const row of education) insEdu.run(...row);

  const commodities = [
    ['grain_sack', 'Grain Sack', 100, 120],
    ['dragonglass_dust', 'Dragonglass Dust', 500, 480],
    ['noble_seal', 'Noble Seal', 2500, 2300]
  ];
  const insComm = db.prepare(
    `INSERT OR IGNORE INTO commodities (id, name, base_price, current_price) VALUES (?, ?, ?, ?)`
  );
  for (const row of commodities) insComm.run(...row);
}
