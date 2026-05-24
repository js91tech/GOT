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
    return { ok: false, message: 'You are not in the maester\'s tent.' };
  }
  const db = getDb();
  if (method === 'item') {
    const inv = getInventory(player.id).find((i) => i.item_id === 'healers_kit' || i.item_id === 'reversal_kit');
    if (!inv || inv.quantity < 1) {
      return {
        ok: false,
        message: 'Need a **Healer\'s Kit** in inventory (`/use healers_kit`) or pay the medical bill / rally morale.'
      };
    }
    removeItem(player.id, inv.item_id, 1);
    db.prepare('UPDATE players SET hospital_until = NULL, hp = max_hp WHERE id = ?').run(player.id);
    audit(db, player.id, 'escape_hospital', 0, { method: 'item' });
    return {
      ok: true,
      message: 'Healer\'s Kit used — you leave the tent at full HP!',
      player: getOrCreatePlayer(discordId, username)
    };
  }
  if (method === 'ce') {
    const cost = balance.hospitalCeEscape ?? 40;
    if (player.ce < cost) {
      return { ok: false, message: `Rally morale costs ${cost}. You have ${player.ce}.` };
    }
    db.prepare('UPDATE players SET ce = ce - ?, hospital_until = NULL, hp = max_hp WHERE id = ?').run(
      cost,
      player.id
    );
    audit(db, player.id, 'escape_hospital', cost, { method: 'ce' });
    return {
      ok: true,
      message: `Rallied ${cost} morale and left the maester's tent!`,
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
    message: `Paid **${coinCost.toLocaleString()}** coins — discharged from the maester's tent!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function escapeJail(discordId, username, method = 'pay') {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (!block.blocked || block.reason !== 'jail') {
    return { ok: false, message: 'You are not in the black cells.' };
  }
  const db = getDb();
  if (method === 'item') {
    const inv = getInventory(player.id).find((i) => i.item_id === 'cell_key' || i.item_id === 'prison_key');
    if (!inv || inv.quantity < 1) {
      return {
        ok: false,
        message: 'Need a **Cell Key** (`cell_key` from shop) or pay bail. Allies can `/bust` you out.'
      };
    }
    removeItem(player.id, inv.item_id, 1);
    db.prepare('UPDATE players SET jail_until = NULL WHERE id = ?').run(player.id);
    audit(db, player.id, 'escape_jail', 0, { method: 'item' });
    return {
      ok: true,
      message: 'Cell Key used — you are free!',
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
    message: `Posted **${coinCost.toLocaleString()}** coin bail — released from the black cells!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function waitOutStatus(discordId, username) {
  const conf = getConfinementStatus(getOrCreatePlayer(discordId, username));
  if (!conf.confined) return { ok: true, message: 'You are not confined — free to act.' };
  return {
    ok: false,
    message:
      conf.reason === 'jail'
        ? `Black cells: **${conf.minutesLeft}m** left (until ${conf.until}). Use /escape jail, pay bail, cell_key, or ally /bust.`
        : `Maester's tent: **${conf.minutesLeft}m** left. Use /escape hospital, healers_kit, pay bill, or rally morale.`
  };
}
