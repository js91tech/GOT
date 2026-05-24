/** Game of Thrones display helpers and legacy ID migration map. */

export const RESOURCE_ICONS = {
  grain: '🌾',
  iron: '⚒️',
  timber: '🪵',
  gold: '👑'
};

export function resourceLabel(type) {
  const labels = { grain: 'Grain', iron: 'Iron', timber: 'Timber', gold: 'Gold' };
  return labels[type] || type;
}

export function resourceIcon(type) {
  return RESOURCE_ICONS[type] || '📦';
}

/** Lord rank from level (cap 50). */
export function lordRank(level) {
  if (level >= 50) return 'Warden of the Realm';
  if (level >= 40) return 'High Lord';
  if (level >= 30) return 'Lord';
  if (level >= 15) return 'Knight';
  if (level >= 5) return 'Sworn Sword';
  return 'Squire';
}

/** Legacy import IDs → Westeros IDs (migration + alias lookup). */
export const ID_RENAMES = {
  janitor: 'stable_hand',
  instructor_assistant: 'squire_duty',
  curator: 'relic_keeper',
  tokyo_jujutsu_high: 'winterfell',
  shibuya_district: 'kings_landing',
  jujutsu_high_kyoto: 'oldtown',
  sakurajima_colony: 'the_wall',
  gojo: 'maester',
  yaga: 'goldcloak',
  nanami: 'septon',
  maki: 'hedge_knight',
  cursed_pit: 'war_yard',
  domain_chamber: 'royal_armory',
  zenin_dojo: 'kingsguard_yard',
  jujutsu_ops: 'kings_guard',
  cursed_logistics: 'coin_masters',
  shibuya_response: 'river_patrol',
  cursed_blade: 'valyrian_steel',
  spirit_spear: 'war_spear',
  domain_charm: 'sigil_charm',
  armor_vest: 'plate_vest',
  cursed_gloves: 'smith_gloves',
  reversal_kit: 'healers_kit',
  rice_bundle: 'grain_bundle',
  iron_ore: 'iron_ingot',
  spirit_core: 'dragonglass',
  grab_bag: 'relic_chest',
  prison_key: 'cell_key',
  ce_shot: 'morale_tonic',
  petty_cleanup: 'petty_raid',
  grade4_patrol: 'border_patrol',
  shibuya_raid: 'sack_village',
  special_exorcism: 'siege_assault',
  tokyo: 'stark',
  kyoto: 'lannister',
  zenin: 'baratheon',
  osaka: 'riverlands',
  sendai: 'reach',
  basics: 'swordcraft',
  black_flash: 'critical_strike',
  domain_theory: 'siegecraft',
  cursed_rice: 'grain_sack',
  spirit_amber: 'dragonglass_dust',
  grade_bead: 'noble_seal',
  cursed_residue: 'iron_ingot',
  spirit_fragment: 'dragonglass',
  bone_shard: 'iron_ingot'
};

/** Human-readable labels for legacy ids still in saves or stale DB rows. */
export const GOT_LABELS = {
  stable_hand: 'Stable Hand',
  squire_duty: 'Squire',
  relic_keeper: 'Relic Keeper',
  janitor: 'Stable Hand',
  instructor_assistant: 'Squire',
  curator: 'Relic Keeper',
  training_grounds: 'Training Grounds',
  war_yard: 'War Yard',
  royal_armory: 'Royal Armory',
  kingsguard_yard: 'Kingsguard Yard',
  kings_guard: "King's Guard",
  coin_masters: 'Coin Masters Guild',
  river_patrol: 'Riverlands Patrol',
  vault_security: 'Vault Security Corp',
  petty_cleanup: 'Petty Border Raid',
  grade4_patrol: 'Border Patrol',
  shibuya_raid: 'Sack the Village',
  special_exorcism: 'Siege Assault',
  tokyo: 'House Stark',
  kyoto: 'House Lannister',
  zenin: 'House Baratheon',
  osaka: 'House Tully',
  sendai: 'House Tyrell',
  cursed_blade: 'Valyrian Steel Blade',
  cursed_gloves: 'Smith Gloves',
  reversal_kit: "Healer's Kit",
  spirit_spear: 'War Spear',
  armor_vest: 'Plate Vest',
  domain_charm: 'Sigil Charm',
  ce_shot: 'Morale Tonic',
  cursed_rice: 'Grain Sack',
  spirit_amber: 'Dragonglass Dust',
  grade_bead: 'Noble Seal',
  basics: 'Swordcraft Basics',
  black_flash: 'Critical Strike Theory',
  domain_theory: 'Siegecraft',
  'Tokyo Jujutsu High': 'House Stark',
  'Kyoto Sister School': 'House Lannister',
  'Zenin Clan': 'House Baratheon',
  'Cursed Rice': 'Grain Sack',
  'Spirit Amber': 'Dragonglass Dust',
  'Grade Bead': 'Noble Seal',
  'Cursed Energy Basics': 'Swordcraft Basics',
  'Black Flash Theory': 'Critical Strike Theory',
  'Domain Expansion Theory': 'Siegecraft',
  'Dorm Room': 'Squire Quarters',
  'Faculty Quarters': 'Lordly Chambers',
  'Domain Loft': 'Dragonstone Keep'
};

export function gotLabel(id, fallbackName) {
  if (id && GOT_LABELS[id]) return GOT_LABELS[id];
  if (fallbackName && GOT_LABELS[fallbackName]) return GOT_LABELS[fallbackName];
  return fallbackName || id || '';
}

export function resolveLegacyId(id) {
  return ID_RENAMES[id] || id;
}

export const EXPLORE_AREAS = ['winterfell', 'kings_landing', 'oldtown', 'the_wall'];
export const EXPLORE_NPCS = ['maester', 'goldcloak', 'septon', 'hedge_knight'];
