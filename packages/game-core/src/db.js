import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL } from './schema.js';

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
      ['explore_area', "TEXT NOT NULL DEFAULT 'tokyo_jujutsu_high'"],
      ['explore_room', "TEXT NOT NULL DEFAULT 'courtyard'"],
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
    ['training_grounds', 'Training Grounds', 'Standard Jujutsu High gym', 1.0, 1, 0],
    ['cursed_pit', 'Cursed Pit', 'High CE density training', 1.15, 5, 25000],
    ['domain_chamber', 'Domain Chamber', 'Elite multiplier', 1.3, 20, 250000],
    ['zenin_dojo', 'Zenin Dojo', 'Speed and dex focus', 1.2, 12, 100000]
  ];
  const insGym = db.prepare(
    `INSERT OR IGNORE INTO gym_definitions (id, name, description, train_multiplier, min_level, unlock_cost) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of gyms) insGym.run(...r);

  const companies = [
    ['jujutsu_ops', 'Jujutsu Ops Division', 'manual_labor', 300, 100, 1.25, 1],
    ['cursed_logistics', 'Cursed Logistics', 'intelligence', 400, 120, 1.3, 5],
    ['shibuya_response', 'Shibuya Response Unit', 'endurance', 500, 140, 1.35, 10],
    ['vault_security', 'Vault Security Corp', 'technique', 600, 160, 1.4, 18]
  ];
  const insCo = db.prepare(
    `INSERT OR IGNORE INTO company_definitions (id, name, worker_stat, base_coins, base_xp, payout_mult, min_level) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const r of companies) insCo.run(...r);

  const drugs = [
    ['ce_shot', 'CE Shot', 'Restore 40 CE', 500, 45, '{"ce":40}'],
    ['focus_tea', 'Focus Tea', '+30 Focus', 350, 30, '{"focus":30}'],
    ['resolve_pill', 'Resolve Pill', '+25 Resolve and Bravery', 400, 60, '{"resolve":25,"bravery":25}'],
    ['booster_serum', 'Booster Serum', '+2 all combat stats', 2500, 180, '{"strength":2,"defense":2,"speed":2,"dexterity":2}']
  ];
  const insDrug = db.prepare(
    `INSERT OR IGNORE INTO drug_definitions (id, name, description, cost, cooldown_minutes, effects_json) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of drugs) insDrug.run(...r);

  const recipes = [
    ['cursed_blade', 'Cursed Blade', 'cursed_blade', '{"iron_ore":2,"spirit_core":1}', 10000, 50],
    ['spirit_spear', 'Spirit Spear', 'spirit_spear', '{"iron_ore":5,"spirit_core":2}', 25000, 100],
    ['armor_vest', 'Cursed Armor Vest', 'armor_vest', '{"iron_ore":4}', 8000, 40],
    ['domain_charm', 'Domain Charm', 'domain_charm', '{"spirit_core":3,"grade_bead":1}', 100000, 200]
  ];
  const insRec = db.prepare(
    `INSERT OR IGNORE INTO forge_recipes (id, name, output_item, materials_json, coin_cost, ce_cost) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of recipes) insRec.run(...r);

  const extraItems = [
    ['spirit_spear', 'Spirit Spear', 'Piercing weapon', 0, 'weapon', '{"strength":5,"speed":2}'],
    ['armor_vest', 'Cursed Armor Vest', 'Chest protection', 0, 'armor', '{"defense":4,"max_hp":15}'],
    ['domain_charm', 'Domain Charm', 'Technique amplifier', 0, 'gear', '{"trainMult":1.08,"dexterity":2}'],
    ['cursed_gloves', 'Cursed Gloves', 'Worker gear', 3500, 'gear', '{"manual_labor":3}'],
    ['scholar_tome', 'Scholar Tome', 'Study aid', 4000, 'gear', '{"intelligence":3}']
  ];
  const insItem = db.prepare(
    `INSERT OR IGNORE INTO item_definitions (id, name, description, shop_price, item_type, effects_json) VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const r of extraItems) insItem.run(...r);
  insItem.run(
    'prison_key',
    'Prison Realm Key',
    'Escape jail instantly',
    12000,
    'consumable',
    '{"jailClear":true}'
  );
}

function seedWorld(db) {
  const items = [
    ['reversal_kit', 'Reversal Kit', 'Clears hospital early', 500, 'consumable', '{"hospitalClear":true}'],
    ['training_weights', 'Training Weights', '+5% train gains', 2500, 'gear', '{"trainMult":1.05}'],
    ['cursed_blade', 'Cursed Blade', '+3 strength', 8000, 'weapon', '{"strength":3}'],
    ['rice_bundle', 'Cursed Rice Bundle', 'Lounge currency x10', 200, 'material', '{"rice":10}'],
    ['iron_ore', 'Cursed Iron', 'Forging material', 1500, 'material', '{"forge":true}'],
    ['spirit_core', 'Spirit Core', 'Forging material', 5000, 'material', '{"forge":true}'],
    ['grab_bag', 'Curse Capsule', 'Mystery loot', 50000, 'consumable', '{"grabBag":true}'],
    ['prison_key', 'Prison Realm Key', 'Escape jail instantly', 12000, 'consumable', '{"jailClear":true}']
  ];
  const insItem = db.prepare(
    `INSERT OR IGNORE INTO item_definitions (id, name, description, shop_price, item_type, effects_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  for (const row of items) insItem.run(...row);

  const crimes = [
    ['petty_cleanup', 'Petty Curse Cleanup', 1, 5, 29, 50, 0.05, 0.02, 0.01],
    ['grade4_patrol', 'Grade-4 Patrol', 5, 15, 45, 120, 0.12, 0.08, 0.05],
    ['shibuya_raid', 'Shibuya Incident Sweep', 15, 30, 80, 400, 0.2, 0.15, 0.1],
    ['special_exorcism', 'Special Grade Exorcism', 30, 50, 150, 1200, 0.35, 0.25, 0.18]
  ];
  const insCrime = db.prepare(
    `INSERT OR IGNORE INTO crime_definitions
     (id, name, min_level, bravery_cost, xp_reward, coin_reward, fail_chance, jail_chance, hospital_chance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of crimes) insCrime.run(...row);

  const jobs = [
    ['janitor', 'Jujutsu High Janitor', 100, 50, 1],
    ['instructor_assistant', 'Instructor Assistant', 500, 200, 5],
    ['curator', 'Cursed Object Curator', 2000, 800, 15]
  ];
  const insJob = db.prepare(
    `INSERT OR IGNORE INTO job_definitions (id, name, coin_payout, xp_payout, min_level) VALUES (?, ?, ?, ?, ?)`
  );
  for (const row of jobs) insJob.run(...row);

  const clans = [
    ['tokyo', 'Tokyo Jujutsu High', 'Main campus squad'],
    ['kyoto', 'Kyoto Sister School', 'Traditional techniques'],
    ['zenin', 'Zenin Clan', 'Ten Shadows legacy']
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
    [4, 'Domain Loft', 50000000, 1.4]
  ];
  const insEstate = db.prepare(
    `INSERT OR IGNORE INTO estate_tiers (tier, name, cost, train_multiplier) VALUES (?, ?, ?, ?)`
  );
  for (const row of estates) insEstate.run(...row);

  const education = [
    ['basics', 'Cursed Energy Basics', 0, 1000, '{"trainMult":1.02}'],
    ['black_flash', 'Black Flash Theory', 10, 50000, '{"critBonus":0.05}'],
    ['domain_theory', 'Domain Expansion Theory', 25, 500000, '{"strength":2}']
  ];
  const insEdu = db.prepare(
    `INSERT OR IGNORE INTO education_courses (id, name, min_level, cost, bonus_json) VALUES (?, ?, ?, ?, ?)`
  );
  for (const row of education) insEdu.run(...row);

  const commodities = [
    ['cursed_rice', 'Cursed Rice', 100, 120],
    ['spirit_amber', 'Spirit Amber', 500, 480],
    ['grade_bead', 'Grade Bead', 2500, 2300]
  ];
  const insComm = db.prepare(
    `INSERT OR IGNORE INTO commodities (id, name, base_price, current_price) VALUES (?, ?, ?, ?)`
  );
  for (const row of commodities) insComm.run(...row);
}
