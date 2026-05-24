const BASE = '/public/assets/items';

const BY_ID = {
  rusty_blade: `${BASE}/sword.svg`,
  valyrian_steel: `${BASE}/sword.svg`,
  iron_longsword: `${BASE}/sword.svg`,
  hunting_knife: `${BASE}/sword.svg`,
  leather_jerkin: `${BASE}/armor.svg`,
  chain_hauberk: `${BASE}/armor.svg`,
  round_shield: `${BASE}/armor.svg`,
  tower_shield: `${BASE}/armor.svg`,
  cursed_blade: `${BASE}/sword.svg`,
  war_spear: `${BASE}/spear.svg`,
  spirit_spear: `${BASE}/spear.svg`,
  training_weights: `${BASE}/weights.svg`,
  plate_vest: `${BASE}/armor.svg`,
  armor_vest: `${BASE}/armor.svg`,
  smith_gloves: `${BASE}/gauntlets.svg`,
  cursed_gloves: `${BASE}/gauntlets.svg`,
  scholar_tome: `${BASE}/tome.svg`,
  sigil_charm: `${BASE}/charm.svg`,
  domain_charm: `${BASE}/charm.svg`,
  healers_kit: `${BASE}/potion.svg`,
  reversal_kit: `${BASE}/potion.svg`,
  cell_key: `${BASE}/key.svg`,
  prison_key: `${BASE}/key.svg`,
  relic_chest: `${BASE}/chest.svg`,
  grab_bag: `${BASE}/chest.svg`,
  grain_bundle: `${BASE}/grain.svg`,
  rice_bundle: `${BASE}/grain.svg`,
  iron_ingot: `${BASE}/iron.svg`,
  iron_ore: `${BASE}/iron.svg`,
  dragonglass: `${BASE}/gem.svg`,
  spirit_core: `${BASE}/gem.svg`,
  noble_seal: `${BASE}/bead.svg`,
  grade_bead: `${BASE}/bead.svg`,
  timber_shard: `${BASE}/grain.svg`,
  gold_dust: `${BASE}/bead.svg`,
  wolf_pelt: `${BASE}/grain.svg`,
  bandit_hood: `${BASE}/gauntlets.svg`,
  deserter_cloak: `${BASE}/armor.svg`,
  smuggler_knife: `${BASE}/sword.svg`,
  grave_dust: `${BASE}/gem.svg`,
  haunted_tome: `${BASE}/tome.svg`,
  cultist_relic: `${BASE}/gem.svg`,
  wildling_axe: `${BASE}/sword.svg`,
  wight_shard: `${BASE}/gem.svg`,
  frostbite_blade: `${BASE}/sword.svg`
};

const BY_TYPE = {
  weapon: `${BASE}/sword.svg`,
  armor: `${BASE}/armor.svg`,
  gear: `${BASE}/gauntlets.svg`,
  consumable: `${BASE}/potion.svg`,
  material: `${BASE}/iron.svg`
};

export function itemIconUrl(itemId, itemType) {
  return BY_ID[itemId] || BY_TYPE[itemType] || `${BASE}/default.svg`;
}
