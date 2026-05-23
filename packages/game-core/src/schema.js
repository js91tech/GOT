export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT 'Sorcerer',
  world_id TEXT NOT NULL DEFAULT 'tokyo',
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 500,
  bank_balance INTEGER NOT NULL DEFAULT 0,
  gold_objects INTEGER NOT NULL DEFAULT 0,
  rice INTEGER NOT NULL DEFAULT 10,
  ce INTEGER NOT NULL DEFAULT 100,
  focus INTEGER NOT NULL DEFAULT 100,
  resolve INTEGER NOT NULL DEFAULT 100,
  strength INTEGER NOT NULL DEFAULT 10,
  defense INTEGER NOT NULL DEFAULT 10,
  speed INTEGER NOT NULL DEFAULT 10,
  dexterity INTEGER NOT NULL DEFAULT 10,
  manual_labor INTEGER NOT NULL DEFAULT 10,
  intelligence INTEGER NOT NULL DEFAULT 10,
  endurance INTEGER NOT NULL DEFAULT 10,
  technique INTEGER NOT NULL DEFAULT 10,
  gym_id TEXT NOT NULL DEFAULT 'training_grounds',
  company_id TEXT,
  explore_area TEXT NOT NULL DEFAULT 'tokyo_jujutsu_high',
  explore_room TEXT NOT NULL DEFAULT 'courtyard',
  npc_progress_json TEXT NOT NULL DEFAULT '{}',
  drug_cooldowns_json TEXT NOT NULL DEFAULT '{}',
  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  bravery INTEGER NOT NULL DEFAULT 100,
  job_id TEXT,
  estate_tier INTEGER NOT NULL DEFAULT 0,
  clan_id TEXT,
  education_json TEXT NOT NULL DEFAULT '[]',
  has_bank_card INTEGER NOT NULL DEFAULT 0,
  investment_amount INTEGER NOT NULL DEFAULT 0,
  investment_matures_at TEXT,
  hospital_until TEXT,
  jail_until TEXT,
  last_work_at TEXT,
  wheel_spins_today INTEGER NOT NULL DEFAULT 0,
  wheel_spin_date TEXT,
  login_streak INTEGER NOT NULL DEFAULT 0,
  last_login_date TEXT,
  energy_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  banned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS item_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  shop_price INTEGER NOT NULL DEFAULT 0,
  item_type TEXT NOT NULL DEFAULT 'consumable',
  effects_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES item_definitions(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  equipped INTEGER NOT NULL DEFAULT 0,
  equip_slot TEXT,
  UNIQUE(player_id, item_id)
);

CREATE TABLE IF NOT EXISTS gym_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  train_multiplier REAL NOT NULL DEFAULT 1.0,
  min_level INTEGER NOT NULL DEFAULT 1,
  unlock_cost INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS company_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  worker_stat TEXT NOT NULL DEFAULT 'manual_labor',
  base_coins INTEGER NOT NULL DEFAULT 200,
  base_xp INTEGER NOT NULL DEFAULT 80,
  payout_mult REAL NOT NULL DEFAULT 1.2,
  min_level INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS drug_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cost INTEGER NOT NULL DEFAULT 100,
  cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  effects_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS forge_recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  output_item TEXT NOT NULL,
  materials_json TEXT NOT NULL DEFAULT '{}',
  coin_cost INTEGER NOT NULL DEFAULT 0,
  ce_cost INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crime_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_level INTEGER NOT NULL DEFAULT 1,
  bravery_cost INTEGER NOT NULL DEFAULT 5,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  coin_reward INTEGER NOT NULL DEFAULT 50,
  fail_chance REAL NOT NULL DEFAULT 0.1,
  jail_chance REAL NOT NULL DEFAULT 0.05,
  hospital_chance REAL NOT NULL DEFAULT 0.05
);

CREATE TABLE IF NOT EXISTS job_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  coin_payout INTEGER NOT NULL DEFAULT 100,
  xp_payout INTEGER NOT NULL DEFAULT 50,
  min_level INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pvp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_id INTEGER NOT NULL,
  defender_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  winner_id INTEGER,
  coins_transferred INTEGER NOT NULL DEFAULT 0,
  xp_gained INTEGER NOT NULL DEFAULT 0,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS market_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES players(id),
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price INTEGER NOT NULL,
  listed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gold_market_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL REFERENCES players(id),
  gold_amount INTEGER NOT NULL,
  price INTEGER NOT NULL,
  listed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  bank_balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS estate_tiers (
  tier INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  train_multiplier REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS education_courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  min_level INTEGER NOT NULL DEFAULT 1,
  cost INTEGER NOT NULL DEFAULT 0,
  bonus_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS commodities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_price INTEGER NOT NULL,
  current_price INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS player_commodities (
  player_id INTEGER NOT NULL REFERENCES players(id),
  commodity_id TEXT NOT NULL REFERENCES commodities(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, commodity_id)
);

CREATE TABLE IF NOT EXISTS delve_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id),
  depth INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS factions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  motto TEXT NOT NULL DEFAULT '',
  crest_key TEXT NOT NULL DEFAULT '',
  bonus_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS guilds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  tag TEXT NOT NULL UNIQUE,
  leader_player_id INTEGER NOT NULL REFERENCES players(id),
  faction_id TEXT REFERENCES factions(id),
  treasury INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (guild_id, player_id)
);

CREATE TABLE IF NOT EXISTS territories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  svg_path_id TEXT NOT NULL,
  map_x INTEGER NOT NULL DEFAULT 0,
  map_y INTEGER NOT NULL DEFAULT 0,
  default_faction_id TEXT REFERENCES factions(id),
  resource_type TEXT NOT NULL,
  base_yield_per_hour INTEGER NOT NULL DEFAULT 100,
  neighbors_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS territory_control (
  territory_id TEXT PRIMARY KEY REFERENCES territories(id),
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  garrison_power INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  tax_rate REAL NOT NULL DEFAULT 0.1
);

CREATE TABLE IF NOT EXISTS territory_sieges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  territory_id TEXT NOT NULL REFERENCES territories(id),
  attacker_guild_id INTEGER NOT NULL REFERENCES guilds(id),
  defender_type TEXT NOT NULL,
  defender_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS player_resources (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_players_discord ON players(discord_id);
CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_pvp_attacker ON pvp_log(attacker_id);
CREATE INDEX IF NOT EXISTS idx_sieges_territory ON territory_sieges(territory_id);
`;
