import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer, getInventory, removeItem } from './player.js';
import { audit, isBlocked } from './util.js';

export function getConfinementStatus(player) {
  const block = isBlocked(player);
  if (!block.blocked) return { confined: false };
  const until = new Date(block.until).getTime();
  const minsLeft = Math.max(0, Math.ceil((until - Date.now()) / 60000));
  return {
    confined: true,
    reason: block.reason,
    until: block.until,
    minutesLeft: minsLeft
  };
}

export function escapeHospital(discordId, username, method = 'pay') {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (!block.blocked || block.reason !== 'hospital') {
    return { ok: false, message: 'You are not in Shoko\'s infirmary.' };
  }
  const db = getDb();
  if (method === 'item') {
    const inv = getInventory(player.id).find((i) => i.item_id === 'reversal_kit');
    if (!inv || inv.quantity < 1) {
      return {
        ok: false,
        message: 'Need a **Reversal Kit** in inventory (`/use reversal_kit`) or pay bail / use CE escape.'
      };
    }
    removeItem(player.id, 'reversal_kit', 1);
    db.prepare('UPDATE players SET hospital_until = NULL, hp = max_hp WHERE id = ?').run(player.id);
    audit(db, player.id, 'escape_hospital', 0, { method: 'item' });
    return {
      ok: true,
      message: 'Reversal Kit used — you leave the infirmary at full HP!',
      player: getOrCreatePlayer(discordId, username)
    };
  }
  if (method === 'ce') {
    const cost = balance.hospitalCeEscape ?? 40;
    if (player.ce < cost) {
      return { ok: false, message: `CE escape costs ${cost} CE. You have ${player.ce}.` };
    }
    db.prepare('UPDATE players SET ce = ce - ?, hospital_until = NULL, hp = max_hp WHERE id = ?').run(
      cost,
      player.id
    );
    audit(db, player.id, 'escape_hospital', cost, { method: 'ce' });
    return {
      ok: true,
      message: `Reverse Cursed Technique — spent ${cost} CE and left the infirmary!`,
      player: getOrCreatePlayer(discordId, username)
    };
  }
  const coinCost = Math.floor((balance.hospitalBailBase ?? 500) * (1 + player.level * 0.15));
  if (player.coins < coinCost) {
    return {
      ok: false,
      message: `Medical bill is **${coinCost.toLocaleString()}** coins. You have ${player.coins.toLocaleString()}.`
    };
  }
  db.prepare('UPDATE players SET coins = coins - ?, hospital_until = NULL, hp = max_hp WHERE id = ?').run(
    coinCost,
    player.id
  );
  audit(db, player.id, 'escape_hospital', coinCost, { method: 'pay' });
  return {
    ok: true,
    message: `Paid **${coinCost.toLocaleString()}** coins — discharged from the infirmary!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function escapeJail(discordId, username, method = 'pay') {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (!block.blocked || block.reason !== 'jail') {
    return { ok: false, message: 'You are not in the Prison Realm.' };
  }
  const db = getDb();
  if (method === 'item') {
    const inv = getInventory(player.id).find((i) => i.item_id === 'prison_key');
    if (!inv || inv.quantity < 1) {
      return {
        ok: false,
        message: 'Need a **Prison Realm Key** (`prison_key` from shop) or pay bail. Allies can `/bust` you out.'
      };
    }
    removeItem(player.id, 'prison_key', 1);
    db.prepare('UPDATE players SET jail_until = NULL WHERE id = ?').run(player.id);
    audit(db, player.id, 'escape_jail', 0, { method: 'item' });
    return {
      ok: true,
      message: 'Prison Realm Key used — you are free!',
      player: getOrCreatePlayer(discordId, username)
    };
  }
  const coinCost = Math.floor((balance.jailBailBase ?? 800) * (1 + player.level * 0.2));
  if (player.coins < coinCost) {
    return {
      ok: false,
      message: `Bail is **${coinCost.toLocaleString()}** coins. You have ${player.coins.toLocaleString()}. Ask an ally to /bust you.`
    };
  }
  db.prepare('UPDATE players SET coins = coins - ?, jail_until = NULL WHERE id = ?').run(coinCost, player.id);
  audit(db, player.id, 'escape_jail', coinCost, { method: 'pay' });
  return {
    ok: true,
    message: `Posted **${coinCost.toLocaleString()}** coin bail — released from the Prison Realm!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

/** Pay to reduce jail/hospital timer by half (optional early release discount) */
export function waitOutStatus(discordId, username) {
  const conf = getConfinementStatus(getOrCreatePlayer(discordId, username));
  if (!conf.confined) return { ok: true, message: 'You are not confined — free to act.' };
  return {
    ok: false,
    message:
      conf.reason === 'jail'
        ? `Prison Realm: **${conf.minutesLeft}m** left (until ${conf.until}). Use /escape jail, /escape pay, prison_key, or ally /bust.`
        : `Infirmary: **${conf.minutesLeft}m** left. Use /escape hospital, reversal_kit, pay bail, or CE escape.`
  };
}
