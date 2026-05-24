import balance from './balance.json' with { type: 'json' };

export function pickInvestmentTier(amount) {
  const tiers = [...(balance.investmentTiers || [])].sort((a, b) => b.min - a.min);
  const match = tiers.find((t) => amount >= t.min);
  if (match) return match;
  if (tiers.length) return tiers[tiers.length - 1];
  return {
    id: 'standard',
    min: balance.investmentMin,
    days: balance.investmentDays,
    returnMult: 2.2
  };
}

export function listInvestmentTiers() {
  return [...(balance.investmentTiers || [])].sort((a, b) => a.min - b.min);
}
