import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer, addItem } from './player.js';
import { applyLevelUps, audit, minutesFromNow, roll, computeScaledXp } from './util.js';

const OUTCOMES = [
  { weight: 25, type: 'coins', min: 100, max: 2000 },
  { weight: 20, type: 'xp', min: 5, max: 50 },
  { weight: 15, type: 'rice', min: 1, max: 5 },
  { weight: 10, type: 'gold', min: 1, max: 1 },
  { weight: 8, type: 'item', itemId: 'healers_kit', qty: 1 },
  { weight: 7, type: 'hospital' },
  { weight: 7, type: 'jail' },
  { weight: 8, type: 'jackpot', min: 5000, max: 25000 }
];

function pickOutcome() {
  const total = OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of OUTCOMES) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return OUTCOMES[0];
}

export function spinWheel(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  if (player.wheel_spins_today >= balance.wheelDailySpins) {
    return { ok: false, message: `Daily limit reached (${balance.wheelDailySpins} spins).` };
  }
  const db = getDb();
  db.prepare('UPDATE players SET wheel_spins_today = wheel_spins_today + 1 WHERE id = ?').run(player.id);
  const outcome = pickOutcome();
  let message;
  switch (outcome.type) {
    case 'coins': {
      const amt = Math.floor(outcome.min + Math.random() * (outcome.max - outcome.min));
      db.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').run(amt, player.id);
      message = `Wheel: +${amt} coins!`;
      break;
    }
    case 'xp': {
      const raw = Math.floor(outcome.min + Math.random() * (outcome.max - outcome.min));
      const amt = computeScaledXp(raw, player, 'general');
      db.prepare('UPDATE players SET xp = xp + ? WHERE id = ?').run(amt, player.id);
      applyLevelUps(db, { ...player, xp: player.xp + amt });
      message = `Wheel: +${amt} XP!`;
      break;
    }
    case 'rice': {
      const amt = Math.floor(outcome.min + Math.random() * (outcome.max - outcome.min + 1));
      db.prepare('UPDATE players SET rice = rice + ? WHERE id = ?').run(amt, player.id);
      message = `Wheel: +${amt} grain rations!`;
      break;
    }
    case 'gold': {
      db.prepare('UPDATE players SET gold_objects = gold_objects + 1 WHERE id = ?').run(player.id);
      message = 'Wheel: +1 royal relic!';
      break;
    }
    case 'item': {
      addItem(player.id, outcome.itemId, outcome.qty || 1);
      message = `Wheel: received ${outcome.itemId}!`;
      break;
    }
    case 'hospital': {
      db.prepare('UPDATE players SET hospital_until = ? WHERE id = ?').run(
        minutesFromNow(balance.hospitalMinutes),
        player.id
      );
      message = 'Wheel: injured — sent to infirmary!';
      break;
    }
    case 'jail': {
      db.prepare('UPDATE players SET jail_until = ? WHERE id = ?').run(
        minutesFromNow(balance.jailMinutes),
        player.id
      );
      message = 'Wheel: caught — thrown in the Black Cells!';
      break;
    }
    case 'jackpot': {
      const amt = Math.floor(outcome.min + Math.random() * (outcome.max - outcome.min));
      db.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').run(amt, player.id);
      message = `JACKPOT! +${amt} coins!`;
      break;
    }
    default:
      message = 'Wheel: nothing happened.';
  }
  audit(db, player.id, 'wheel', 0, { outcome: outcome.type });
  return { ok: true, message, player: getOrCreatePlayer(discordId, username) };
}
