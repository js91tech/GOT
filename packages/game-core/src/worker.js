import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer } from './player.js';
import { applyLevelUps, audit, isBlocked, roll } from './util.js';

export const WORKER_STATS = ['manual_labor', 'intelligence', 'endurance', 'technique'];

export const WORKER_LABELS = {
  manual_labor: 'Manual Labor',
  intelligence: 'Intelligence',
  endurance: 'Endurance',
  technique: 'Technique'
};

export function normalizeWorkerStat(stat) {
  const key = String(stat || 'manual_labor').toLowerCase();
  return WORKER_STATS.includes(key) ? key : 'manual_labor';
}

export function trainWorker(discordId, username, stat, sets = 1) {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (block.blocked) return { ok: false, message: 'Cannot train while hospitalized or jailed.' };
  const db = getDb();
  const workerStat = normalizeWorkerStat(stat);
  const label = WORKER_LABELS[workerStat];
  sets = Math.max(1, Math.min(20, sets));
  let totalGain = 0;
  let totalXp = 0;
  let ce = player.ce;
  const ceCost = balance.workerTrainCeCost ?? 8;
  const gainBase = balance.workerTrainGain ?? 2;
  for (let i = 0; i < sets; i++) {
    if (ce < ceCost) break;
    ce -= ceCost;
    let gain = gainBase;
    if (roll(0.05)) gain = Math.floor(gain * 1.5);
    totalGain += gain;
    totalXp += balance.trainXpGain;
  }
  if (totalGain === 0) return { ok: false, message: 'Not enough Morale for worker training.' };
  db.prepare(`UPDATE players SET ce = ?, ${workerStat} = ${workerStat} + ?, xp = xp + ? WHERE id = ?`).run(
    ce,
    totalGain,
    totalXp,
    player.id
  );
  audit(db, player.id, 'worker_train', totalGain, { stat: workerStat, sets });
  applyLevelUps(db, { ...player, xp: player.xp + totalXp });
  return {
    ok: true,
    message: `Worker training: +${totalGain} ${label}, +${totalXp} XP.`,
    player: getOrCreatePlayer(discordId, username)
  };
}
