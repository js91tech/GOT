import balance from './balance.json' with { type: 'json' };

/** Morale regen stops here (100 base, +25 from shop). */
export function getMoraleRegenCap(player) {
  return (balance.ceMax ?? 100) + (player.ce_cap_bonus || 0);
}

/** Focus resting cap (same pattern as morale). */
export function getFocusRegenCap(player) {
  return (balance.focusMax ?? 100) + (player.focus_cap_bonus || 0);
}

/** Morale can be pushed above regen cap via tonics/feasts up to here. */
export function getMoraleOverflowCap(player) {
  return (balance.ceOverflowMax ?? 200) + (player.ce_cap_bonus || 0);
}

export function getFocusOverflowCap(player) {
  return (balance.focusOverflowMax ?? 200) + (player.focus_cap_bonus || 0);
}

export function clampMorale(value, player) {
  return Math.max(0, Math.min(getMoraleOverflowCap(player), value));
}

export function clampFocus(value, player) {
  return Math.max(0, Math.min(getFocusOverflowCap(player), value));
}

/** Regen tick — never exceeds regen cap. */
export function applyMoraleRegen(current, gain, player) {
  const cap = getMoraleRegenCap(player);
  return Math.min(cap, current + gain);
}

/** Focus regen tick — never exceeds regen cap. */
export function applyFocusRegen(current, gain, player) {
  const cap = getFocusRegenCap(player);
  return Math.min(cap, current + gain);
}

export function moraleCapCost(player, percent) {
  return Math.ceil((getMoraleRegenCap(player) * percent) / 100);
}

export function canBuyCapBonus(player, kind) {
  const bonus = balance.capBonusAmount ?? 25;
  if (kind === 'ce') return (player.ce_cap_bonus || 0) < bonus;
  if (kind === 'focus') return (player.focus_cap_bonus || 0) < bonus;
  return false;
}
