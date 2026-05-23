import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer } from './player.js';
import {
  applyLevelUps,
  audit,
  getCritChance,
  getTrainMultiplier,
  isBlocked,
  roll
} from './util.js';
import { normalizeTrainStat, TRAIN_STAT_LABELS } from './stats.js';

const GAIN_KEYS = {
  strength: 'trainStrengthGain',
  defense: 'trainDefenseGain',
  speed: 'trainSpeedGain',
  dexterity: 'trainDexterityGain'
};

export function train(discordId, username, sets = 1, stat = 'strength') {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (block.blocked && block.reason === 'jail') {
    return { ok: false, message: 'You are confined in the Prison Realm. Only /wheel, /inventory, /use, /bust work.' };
  }
  if (block.blocked && block.reason === 'hospital') {
    return { ok: false, message: 'You are in Shoko\'s infirmary. Use a Reversal Kit or wait.' };
  }
  const db = getDb();
  sets = Math.max(1, Math.min(20, sets));
  const trainStat = normalizeTrainStat(stat);
  const label = TRAIN_STAT_LABELS[trainStat];
  const baseGain = balance[GAIN_KEYS[trainStat]] ?? balance.trainStrengthGain;
  let totalGain = 0;
  let totalXp = 0;
  let crits = 0;
  const mult = getTrainMultiplier(player, db);
  let ce = player.ce;
  let focus = player.focus;
  for (let i = 0; i < sets; i++) {
    if (ce < balance.trainCeCost || focus < balance.trainFocusCost) break;
    ce -= balance.trainCeCost;
    focus -= balance.trainFocusCost;
    let gain = Math.floor(baseGain * mult);
    if (roll(getCritChance(player, db))) {
      gain = Math.floor(gain * 1.5);
      crits++;
    }
    totalGain += gain;
    totalXp += balance.trainXpGain;
  }
  if (totalGain === 0) {
    return { ok: false, message: 'Not enough CE or Focus. Rest at the CE lounge or wait for regen.' };
  }
  db.prepare(
    `UPDATE players SET ce = ?, focus = ?, ${trainStat} = ${trainStat} + ?, xp = xp + ? WHERE id = ?`
  ).run(ce, focus, totalGain, totalXp, player.id);
  audit(db, player.id, 'train', totalGain, { sets, crits, stat: trainStat });
  applyLevelUps(db, { ...player, xp: player.xp + totalXp });
  const updated = getOrCreatePlayer(discordId, username);
  let msg = `Training complete! +${totalGain} ${label}, +${totalXp} XP.`;
  if (crits) msg += ` Black Flash procs: ${crits}!`;
  return { ok: true, message: msg, player: updated };
}
