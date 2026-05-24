import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer } from './player.js';
import { audit } from './util.js';

export function loungeAction(discordId, username, action) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  switch (action) {
    case 'tea': {
      if (player.rice < 5) return { ok: false, message: 'Need 5 grain rations for a feast (+5 Focus).' };
      db.prepare('UPDATE players SET rice = rice - 5, focus = MIN(focus + 5, 100) WHERE id = ?').run(
        player.id
      );
      audit(db, player.id, 'lounge_tea', 5, {});
      return {
        ok: true,
        message: 'You feast in the war camp. +5 Focus.',
        player: getOrCreatePlayer(discordId, username)
      };
    }
    case 'vow': {
      if (player.rice < 10) return { ok: false, message: 'Need 10 grain rations for an oath of fealty.' };
      db.prepare(
        `UPDATE players SET rice = rice - 10, resolve = MIN(resolve + 20, 100), bravery = MIN(bravery + 20, 100) WHERE id = ?`
      ).run(player.id);
      audit(db, player.id, 'lounge_vow', 10, {});
      return {
        ok: true,
        message: 'Oath of fealty sworn! +20 Resolve and Bravery.',
        player: getOrCreatePlayer(discordId, username)
      };
    }
    case 'refill': {
      const cost = 12;
      if (player.gold_objects < 1 && player.coins < cost * 1000) {
        return { ok: false, message: 'Morale rally costs 1 royal relic or 12,000 coins.' };
      }
      if (player.gold_objects >= 1) {
        db.prepare('UPDATE players SET gold_objects = gold_objects - 1, ce = ? WHERE id = ?').run(
          balance.ceMax,
          player.id
        );
      } else {
        db.prepare('UPDATE players SET coins = coins - ?, ce = ? WHERE id = ?').run(
          cost * 1000,
          balance.ceMax,
          player.id
        );
      }
      audit(db, player.id, 'lounge_refill', cost, {});
      return {
        ok: true,
        message: 'Morale fully restored!',
        player: getOrCreatePlayer(discordId, username)
      };
    }
    default:
      return { ok: false, message: 'Actions: tea (feast), vow (oath), refill (rally morale)' };
  }
}
