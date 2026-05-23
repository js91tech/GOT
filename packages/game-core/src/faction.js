import { getDb } from './db.js';
import { getOrCreatePlayer } from './player.js';

export function listFactions() {
  return getDb().prepare('SELECT * FROM factions ORDER BY name').all();
}

export function joinFaction(discordId, username, factionId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const faction = db.prepare('SELECT * FROM factions WHERE id = ?').get(factionId);
  if (!faction) {
    const ids = listFactions()
      .map((f) => f.id)
      .join(', ');
    return { ok: false, message: `Unknown house. Choose: ${ids}` };
  }
  if (player.faction_id && player.faction_id !== factionId) {
    return { ok: false, message: 'You already serve another house.' };
  }
  db.prepare('UPDATE players SET faction_id = ? WHERE id = ?').run(factionId, player.id);
  return {
    ok: true,
    message: `You now serve ${faction.name}. ${faction.motto}`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function getPlayerFaction(player) {
  if (!player?.faction_id) return null;
  return getDb().prepare('SELECT * FROM factions WHERE id = ?').get(player.faction_id);
}
