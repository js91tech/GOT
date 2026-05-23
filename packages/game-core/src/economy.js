import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer, getInventory, addItem, removeItem } from './player.js';
import { applyLevelUps, audit, isBlocked, requireLevel } from './util.js';
import { openGrabBag } from './phase3.js';
import { companyWork } from './company.js';

export function bank(discordId, username, action, amount) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  amount = Math.floor(Number(amount) || 0);
  if (amount <= 0) return { ok: false, message: 'Invalid amount.' };
  if (action === 'deposit') {
    if (player.coins < amount) return { ok: false, message: 'Not enough coins on hand.' };
    db.prepare('UPDATE players SET coins = coins - ?, bank_balance = bank_balance + ? WHERE id = ?').run(
      amount,
      amount,
      player.id
    );
    audit(db, player.id, 'bank_deposit', amount, {});
    return { ok: true, message: `Deposited ${amount} to HQ Treasury.`, player: getOrCreatePlayer(discordId, username) };
  }
  if (action === 'withdraw') {
    if (player.bank_balance < amount) return { ok: false, message: 'Insufficient bank balance.' };
    db.prepare('UPDATE players SET coins = coins + ?, bank_balance = bank_balance - ? WHERE id = ?').run(
      amount,
      amount,
      player.id
    );
    audit(db, player.id, 'bank_withdraw', amount, {});
    return { ok: true, message: `Withdrew ${amount} coins.`, player: getOrCreatePlayer(discordId, username) };
  }
  if (action === 'buycard') {
    if (player.has_bank_card) return { ok: false, message: 'You already have a Treasury Card.' };
    if (player.coins < balance.bankCardCost) {
      return { ok: false, message: `Treasury Card costs ${balance.bankCardCost.toLocaleString()} coins.` };
    }
    db.prepare('UPDATE players SET coins = coins - ?, has_bank_card = 1 WHERE id = ?').run(
      balance.bankCardCost,
      player.id
    );
    return { ok: true, message: 'Treasury Card purchased! Higher daily interest.', player: getOrCreatePlayer(discordId, username) };
  }
  if (action === 'invest') {
    if (amount < balance.investmentMin) {
      return { ok: false, message: `Minimum investment is ${balance.investmentMin.toLocaleString()}.` };
    }
    if (player.bank_balance < amount) return { ok: false, message: 'Not enough in bank.' };
    const matures = new Date(Date.now() + balance.investmentDays * 86400000).toISOString();
    db.prepare(
      `UPDATE players SET bank_balance = bank_balance - ?, investment_amount = ?, investment_matures_at = ? WHERE id = ?`
    ).run(amount, amount, matures, player.id);
    return {
      ok: true,
      message: `Invested ${amount.toLocaleString()} for ${balance.investmentDays} days (~200% return).`,
      player: getOrCreatePlayer(discordId, username)
    };
  }
  return { ok: false, message: 'Actions: deposit, withdraw, buycard, invest' };
}

export function collectInvestment(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  if (!player.investment_amount) return { ok: false, message: 'No active investment.' };
  if (new Date(player.investment_matures_at).getTime() > Date.now()) {
    return { ok: false, message: 'Investment not mature yet.' };
  }
  const payout = Math.floor(player.investment_amount * 2.2);
  const db = getDb();
  db.prepare(
    `UPDATE players SET bank_balance = bank_balance + ?, investment_amount = 0, investment_matures_at = NULL WHERE id = ?`
  ).run(payout, player.id);
  return { ok: true, message: `Investment matured! +${payout.toLocaleString()} to bank.`, player: getOrCreatePlayer(discordId, username) };
}

export function shopList() {
  const db = getDb();
  return db.prepare('SELECT * FROM item_definitions WHERE shop_price > 0 ORDER BY shop_price').all();
}

export function shopBuy(discordId, username, itemId, quantity = 1) {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (block.blocked && block.reason === 'jail') {
    return { ok: false, message: 'Cannot shop while in Prison Realm.' };
  }
  const db = getDb();
  const item = db.prepare('SELECT * FROM item_definitions WHERE id = ?').get(itemId);
  if (!item) return { ok: false, message: 'Item not found.' };
  quantity = Math.max(1, Math.min(99, quantity));
  const cost = item.shop_price * quantity;
  if (player.coins < cost) return { ok: false, message: `Need ${cost} coins.` };
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(cost, player.id);
  addItem(player.id, itemId, quantity);
  audit(db, player.id, 'shop_buy', cost, { itemId, quantity });
  return {
    ok: true,
    message: `Bought ${quantity}x ${item.name} for ${cost} coins.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function work(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  if (player.company_id) return companyWork(discordId, username);
  const block = isBlocked(player);
  if (block.blocked) return { ok: false, message: 'Cannot work while hospitalized or jailed.' };
  const db = getDb();
  const jobId = player.job_id || 'janitor';
  const job = db.prepare('SELECT * FROM job_definitions WHERE id = ?').get(jobId);
  if (!job) return { ok: false, message: 'No job. Use /job set <id>.' };
  const lvl = requireLevel(player, job.min_level, job.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  if (player.last_work_at) {
    const next = new Date(player.last_work_at).getTime() + balance.workCooldownMinutes * 60000;
    if (Date.now() < next) {
      const mins = Math.ceil((next - Date.now()) / 60000);
      return { ok: false, message: `Work cooldown: ${mins}m remaining.` };
    }
  }
  db.prepare(
    `UPDATE players SET coins = coins + ?, xp = xp + ?, last_work_at = datetime('now') WHERE id = ?`
  ).run(job.coin_payout, job.xp_payout, player.id);
  applyLevelUps(db, { ...player, xp: player.xp + job.xp_payout });
  audit(db, player.id, 'work', job.coin_payout, { jobId });
  return {
    ok: true,
    message: `${job.name}: +${job.coin_payout} coins, +${job.xp_payout} XP.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function setJob(discordId, username, jobId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const job = db.prepare('SELECT * FROM job_definitions WHERE id = ?').get(jobId);
  if (!job) return { ok: false, message: 'Jobs: janitor, instructor_assistant, curator' };
  const lvl = requireLevel(player, job.min_level, job.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  db.prepare('UPDATE players SET job_id = ? WHERE id = ?').run(jobId, player.id);
  return { ok: true, message: `Job set to ${job.name}.`, player: getOrCreatePlayer(discordId, username) };
}

export function useItem(discordId, username, itemId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const inv = getInventory(player.id).find((i) => i.item_id === itemId);
  if (!inv || inv.quantity < 1) return { ok: false, message: 'Item not in inventory.' };
  const effects = JSON.parse(inv.effects_json || '{}');
  if (effects.hospitalClear && player.hospital_until) {
    removeItem(player.id, itemId, 1);
    db.prepare('UPDATE players SET hospital_until = NULL, hp = max_hp WHERE id = ?').run(player.id);
    return { ok: true, message: 'Reversal Kit used. Released from infirmary!', player: getOrCreatePlayer(discordId, username) };
  }
  if (effects.jailClear && player.jail_until) {
    removeItem(player.id, itemId, 1);
    db.prepare('UPDATE players SET jail_until = NULL WHERE id = ?').run(player.id);
    return { ok: true, message: 'Prison Realm Key used. You are free!', player: getOrCreatePlayer(discordId, username) };
  }
  if (effects.grabBag) {
    return openGrabBag(discordId, username, true);
  }
  return { ok: false, message: 'This item cannot be used right now.' };
}
