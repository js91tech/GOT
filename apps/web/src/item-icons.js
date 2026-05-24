import { assetUrl } from './assets.js';

const BASE = '/public/assets/items';

const BY_ID = {
  rusty_blade: `${BASE}/rusty_sword.svg`,
  valyrian_steel: `${BASE}/valyrian_blade.svg`,
  cursed_blade: `${BASE}/valyrian_blade.svg`,
  iron_longsword: `${BASE}/sword.svg`,
  hunting_knife: `${BASE}/dagger.svg`,
  smuggler_knife: `${BASE}/dagger.svg`,
  leather_jerkin: `${BASE}/leather_armor.svg`,
  chain_hauberk: `${BASE}/chainmail.svg`,
  round_shield: `${BASE}/shield.svg`,
  tower_shield: `${BASE}/shield.svg`,
  plate_vest: `${BASE}/plate_armor.svg`,
  armor_vest: `${BASE}/plate_armor.svg`,
  cursed_gloves: `${BASE}/gauntlets.svg`,
  smith_gloves: `${BASE}/gauntlets.svg`,
  reversal_kit: `${BASE}/healers_potion.svg`,
  healers_kit: `${BASE}/healers_potion.svg`,
  war_spear: `${BASE}/spear.svg`,
  spirit_spear: `${BASE}/spear.svg`,
  wildling_axe: `${BASE}/axe.svg`,
  frostbite_blade: `${BASE}/frost_blade.svg`,
  training_weights: `${BASE}/weights.svg`,
  scholar_tome: `${BASE}/tome.svg`,
  haunted_tome: `${BASE}/haunted_tome.svg`,
  sigil_charm: `${BASE}/charm.svg`,
  domain_charm: `${BASE}/charm.svg`,
  cell_key: `${BASE}/key.svg`,
  prison_key: `${BASE}/key.svg`,
  relic_chest: `${BASE}/chest.svg`,
  grab_bag: `${BASE}/chest.svg`,
  grain_bundle: `${BASE}/grain.svg`,
  rice_bundle: `${BASE}/grain.svg`,
  grain_sack: `${BASE}/grain.svg`,
  iron_ingot: `${BASE}/iron.svg`,
  iron_ore: `${BASE}/iron.svg`,
  dragonglass: `${BASE}/dragonglass.svg`,
  spirit_core: `${BASE}/dragonglass.svg`,
  dragonglass_dust: `${BASE}/gem.svg`,
  noble_seal: `${BASE}/bead.svg`,
  grade_bead: `${BASE}/bead.svg`,
  timber_shard: `${BASE}/timber.svg`,
  gold_dust: `${BASE}/gold_dust.svg`,
  wolf_pelt: `${BASE}/pelt.svg`,
  bandit_hood: `${BASE}/hood.svg`,
  deserter_cloak: `${BASE}/cloak.svg`,
  grave_dust: `${BASE}/dust.svg`,
  cultist_relic: `${BASE}/cult_relic.svg`,
  wight_shard: `${BASE}/shard.svg`,
  battlehorn_relic: `${BASE}/relic_horn.svg`,
  focus_crown_relic: `${BASE}/relic_crown.svg`,
  morale_tonic: `${BASE}/tonic.svg`
};

const BY_TYPE = {
  weapon: `${BASE}/sword.svg`,
  armor: `${BASE}/armor.svg`,
  gear: `${BASE}/gauntlets.svg`,
  consumable: `${BASE}/potion.svg`,
  material: `${BASE}/iron.svg`,
  upgrade: `${BASE}/relic_horn.svg`
};

export function itemIconUrl(itemId, itemType) {
  const path = BY_ID[itemId] || BY_TYPE[itemType] || `${BASE}/default.svg`;
  return assetUrl(path);
}
