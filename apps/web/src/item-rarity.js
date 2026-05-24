/** Rarity tier for inventory/shop framing. */
export function itemRarityTier(itemId, itemType, shopPrice = 0) {
  const price = Number(shopPrice) || 0;
  if (itemId === 'battlehorn_relic' || itemId === 'focus_crown_relic' || itemId === 'valyrian_steel') {
    return 'legendary';
  }
  if (price >= 480000 || itemId === 'relic_chest' || itemId === 'grab_bag') return 'legendary';
  if (price >= 50000 || itemId === 'sigil_charm' || itemId === 'domain_charm') return 'epic';
  if (price >= 8000 || itemId === 'war_spear' || itemId === 'spirit_spear' || itemId === 'plate_vest' || itemId === 'armor_vest') {
    return 'rare';
  }
  if (price >= 2000 || itemType === 'weapon' || itemType === 'armor') return 'uncommon';
  if (itemType === 'upgrade') return 'epic';
  return 'common';
}
