import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer } from './player.js';
import { getEffectiveWorkerStats } from './stats.js';
import { applyLevelUps, audit, isBlocked, requireLevel } from './util.js';

export function listCompanies() {
  return getDb().prepare('SELECT * FROM company_definitions ORDER BY min_level').all();
}

export function joinCompany(discordId, username, companyId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const co = db.prepare('SELECT * FROM company_definitions WHERE id = ?').get(companyId);
  if (!co) return { ok: false, message: 'Companies: kings_guard, coin_masters, river_patrol, vault_security' };
  const lvl = requireLevel(player, co.min_level, co.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  db.prepare('UPDATE players SET company_id = ? WHERE id = ?').run(companyId, player.id);
  return {
    ok: true,
    message: `Joined **${co.name}**. Use /work for boosted payouts (+${Math.round((co.payout_mult - 1) * 100)}%).`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function companyWork(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (block.blocked) return { ok: false, message: 'Cannot work while hospitalized or jailed.' };
  if (!player.company_id) return { ok: false, message: 'Join a company first: /company join <id>' };
  const db = getDb();
  const co = db.prepare('SELECT * FROM company_definitions WHERE id = ?').get(player.company_id);
  if (!co) return { ok: false, message: 'Invalid company.' };
  if (player.last_work_at) {
    const next = new Date(player.last_work_at).getTime() + balance.workCooldownMinutes * 60000;
    if (Date.now() < next) {
      const mins = Math.ceil((next - Date.now()) / 60000);
      return { ok: false, message: `Work cooldown: ${mins}m remaining.` };
    }
  }
  const workerStat = co.worker_stat;
  const statVal = getEffectiveWorkerStats(player, db)[workerStat] ?? 10;
  const coins = Math.floor(co.base_coins * co.payout_mult * (1 + statVal / 100));
  const xp = Math.floor(co.base_xp * co.payout_mult);
  db.prepare(
    `UPDATE players SET coins = coins + ?, xp = xp + ?, last_work_at = datetime('now') WHERE id = ?`
  ).run(coins, xp, player.id);
  applyLevelUps(db, { ...player, xp: player.xp + xp });
  audit(db, player.id, 'company_work', coins, { companyId: co.id });
  return {
    ok: true,
    message: `${co.name}: +${coins} coins, +${xp} XP (uses your ${workerStat}).`,
    player: getOrCreatePlayer(discordId, username)
  };
}
