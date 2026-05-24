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

/** Lord rank from level (replaces JJK grade tiers). */
export function lordRank(level) {
  if (level >= 80) return 'Warden';
  if (level >= 50) return 'High Lord';
  if (level >= 30) return 'Lord';
  if (level >= 15) return 'Knight';
  return 'Squire';
}

/** Old anime IDs → Westeros IDs (migration + alias lookup). */
export const ID_RENAMES = {
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

export function resolveLegacyId(id) {
  return ID_RENAMES[id] || id;
}

export const EXPLORE_AREAS = ['winterfell', 'kings_landing', 'oldtown', 'the_wall'];
export const EXPLORE_NPCS = ['maester', 'goldcloak', 'septon', 'hedge_knight'];
