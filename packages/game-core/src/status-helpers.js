import balance from './balance.json' with { type: 'json' };
import { getDb } from './db.js';
import { xpForLevel, maxLevel } from './util.js';
import { gotLabel, resolveLegacyId } from './got-theme.js';
import { getWorkCooldownReduction } from './stats.js';
import { getMoraleRegenCap, getFocusRegenCap } from './energy.js';
import { pickInvestmentTier } from './investment-tiers.js';

export function getXpProgress(player) {
  const cap = maxLevel();
  if (player.level >= cap) {
    return { xp_current: player.xp, xp_needed: 0, xp_pct: 100, at_cap: true };
  }
  const needed = xpForLevel(player.level);
  const pct = needed ? Math.min(100, Math.round((player.xp / needed) * 100)) : 0;
  return { xp_current: player.xp, xp_needed: needed, xp_pct: pct, at_cap: false };
}

export function getWorkCooldownStatus(player, db = getDb()) {
  if (!player.last_work_at) return { work_ready: true, work_minutes_left: 0, work_ready_at: null };
  const cooldownMs = balance.workCooldownMinutes * 60000 * (1 - getWorkCooldownReduction(player, db));
  const next = new Date(player.last_work_at).getTime() + cooldownMs;
  const left = next - Date.now();
  if (left <= 0) return { work_ready: true, work_minutes_left: 0, work_ready_at: null };
  return {
    work_ready: false,
    work_minutes_left: Math.ceil(left / 60000),
    work_ready_at: new Date(next).toISOString()
  };
}

export function getMoraleRegenIn(player) {
  const cap = getMoraleRegenCap(player);
  if (player.ce >= cap) return { morale_regen_in: 0, morale_regen_at: null };
  const intervalMs = balance.ceRegenMinutes * 60 * 1000;
  const updatedAt = new Date(player.energy_updated_at || new Date().toISOString()).getTime();
  const next = updatedAt + intervalMs;
  const left = next - Date.now();
  return {
    morale_regen_in: Math.max(0, Math.ceil(left / 60000)),
    morale_regen_at: new Date(next).toISOString()
  };
}

export function getFocusRegenIn(player) {
  const cap = getFocusRegenCap(player);
  if (player.focus >= cap) return { focus_regen_in: 0, focus_regen_at: null };
  const intervalMs = (balance.focusRegenMinutes ?? 10) * 60 * 1000;
  const updatedAt = new Date(player.focus_updated_at || player.energy_updated_at || new Date().toISOString()).getTime();
  const next = updatedAt + intervalMs;
  const left = next - Date.now();
  return {
    focus_regen_in: Math.max(0, Math.ceil(left / 60000)),
    focus_regen_at: new Date(next).toISOString()
  };
}

export function getDelveStatus(player, db = getDb()) {
  const active = db
    .prepare(`SELECT depth FROM delve_runs WHERE player_id = ? AND status = 'active'`)
    .get(player.id);
  if (!active) return { delve_active: false, delve_depth: 0 };
  return { delve_active: true, delve_depth: active.depth };
}

export function getInvestmentStatus(player) {
  if (!player.investment_amount) {
    return { investment_mature: false, investment_minutes_left: 0 };
  }
  const tier = pickInvestmentTier(player.investment_amount);
  const returnMult = player.investment_return_mult || tier?.returnMult || 2.2;
  const matureAt = new Date(player.investment_matures_at).getTime();
  const left = matureAt - Date.now();
  if (left <= 0) {
    return {
      investment_mature: true,
      investment_minutes_left: 0,
      investment_tier_id: tier?.id,
      investment_return_mult: returnMult,
      investment_tier_days: tier?.days
    };
  }
  return {
    investment_mature: false,
    investment_minutes_left: Math.ceil(left / 60000),
    investment_tier_id: tier?.id,
    investment_return_mult: returnMult,
    investment_tier_days: tier?.days
  };
}

export function getDrugCooldownsLeft(player) {
  const cooldowns = JSON.parse(player.drug_cooldowns_json || '{}');
  const out = {};
  const now = Date.now();
  for (const [id, until] of Object.entries(cooldowns)) {
    const left = new Date(until).getTime() - now;
    if (left > 0) out[resolveLegacyId(id)] = Math.ceil(left / 60000);
  }
  return out;
}

export function resolveDisplayNames(player, db = getDb()) {
  const jobId = resolveLegacyId(player.job_id || 'stable_hand');
  const job = db.prepare('SELECT name FROM job_definitions WHERE id = ?').get(jobId);
  const gymId = resolveLegacyId(player.gym_id || 'training_grounds');
  const gym = db.prepare('SELECT name FROM gym_definitions WHERE id = ?').get(gymId);
  const companyId = player.company_id ? resolveLegacyId(player.company_id) : null;
  const company = companyId
    ? db.prepare('SELECT name FROM company_definitions WHERE id = ?').get(companyId)
    : null;
  return {
    job_id: jobId,
    job_name: job?.name || gotLabel(jobId, 'Stable Hand'),
    gym_id: gymId,
    gym_name: gym?.name || gotLabel(gymId, gymId?.replace(/_/g, ' ')),
    company_name: company ? company.name : companyId ? gotLabel(companyId, companyId) : null
  };
}

export function isUsableItemEffects(effects) {
  return !!(
    effects.hospitalClear ||
    effects.jailClear ||
    effects.grabBag ||
    effects.ce ||
    effects.focus
  );
}
