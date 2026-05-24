const BASE = '/public/assets/items';

const BY_ID = {
  cursed_blade: `${BASE}/sword.svg`,
  spirit_spear: `${BASE}/spear.svg`,
  training_weights: `${BASE}/weights.svg`,
  armor_vest: `${BASE}/armor.svg`,
  cursed_gloves: `${BASE}/gauntlets.svg`,
  scholar_tome: `${BASE}/tome.svg`,
  domain_charm: `${BASE}/charm.svg`,
  reversal_kit: `${BASE}/potion.svg`,
  prison_key: `${BASE}/key.svg`,
  grab_bag: `${BASE}/chest.svg`,
  rice_bundle: `${BASE}/grain.svg`,
  iron_ore: `${BASE}/iron.svg`,
  spirit_core: `${BASE}/gem.svg`,
  grade_bead: `${BASE}/bead.svg`
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
