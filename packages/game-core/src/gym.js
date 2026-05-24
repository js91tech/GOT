import { getDb } from './db.js';
import { getOrCreatePlayer } from './player.js';
import { audit, requireLevel } from './util.js';

export function listGyms() {
  return getDb().prepare('SELECT * FROM gym_definitions ORDER BY min_level').all();
}

export function getGymMultiplier(player, db) {
  const gym = db.prepare('SELECT train_multiplier FROM gym_definitions WHERE id = ?').get(player.gym_id || 'training_grounds');
  return gym?.train_multiplier ?? 1;
}

export function setGym(discordId, username, gymId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const gym = db.prepare('SELECT * FROM gym_definitions WHERE id = ?').get(gymId);
  if (!gym) return { ok: false, message: 'Gyms: training_grounds, war_yard, royal_armory, kingsguard_yard' };
  const lvl = requireLevel(player, gym.min_level, gym.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  if (gym.unlock_cost > 0 && player.coins < gym.unlock_cost) {
    return { ok: false, message: `Unlock costs ${gym.unlock_cost.toLocaleString()} coins.` };
  }
  if (gym.unlock_cost > 0) {
    db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(gym.unlock_cost, player.id);
  }
  db.prepare('UPDATE players SET gym_id = ? WHERE id = ?').run(gymId, player.id);
  audit(db, player.id, 'gym_set', 0, { gymId });
  return {
    ok: true,
    message: `Training at **${gym.name}** (x${gym.train_multiplier} gains).`,
    player: getOrCreatePlayer(discordId, username)
  };
}
