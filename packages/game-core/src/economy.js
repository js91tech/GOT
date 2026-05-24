import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { getOrCreatePlayer, getInventory, addItem, removeItem } from './player.js';
import { applyLevelUps, audit, isBlocked, requireLevel, computeScaledXp } from './util.js';
import { openGrabBag } from './phase3.js';
import { companyWork } from './company.js';
import { equipItem, slotForItem } from './equip.js';
import { getEffectiveWorkerStats, getWorkCooldownReduction } from './stats.js';
import { canBuyCapBonus, clampMorale, clampFocus } from './energy.js';
import { resolveLegacyId } from './got-theme.js';

const JOB_WORKER_STAT = {
  stable_hand: 'manual_labor',
  squire_duty: 'technique',
  relic_keeper: 'intelligence',
  janitor: 'manual_labor',
  instructor_assistant: 'technique',
  curator: 'intelligence'
};

const JOB_LIST_HINT = 'Stable Hand, Squire, Relic Keeper';

export function listJobs() {
  return getDb().prepare('SELECT * FROM job_definitions ORDER BY min_level').all();
}

function resolveJobId(player) {
  return resolveLegacyId(player.job_id || 'stable_hand');
}

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
    return { ok: true, message: `Deposited ${amount} to the Keep Treasury.`, player: getOrCreatePlayer(discordId, username) };
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

export function shopList(type = null) {
  const db = getDb();
  if (type === 'armory') {
    return db
      .prepare(
        `SELECT * FROM item_definitions WHERE shop_price > 0 AND item_type IN ('weapon','armor')
         ORDER BY min_level, shop_price`
      )
      .all();
  }
  if (type === 'gear') {
    return db
      .prepare(
        `SELECT * FROM item_definitions WHERE shop_price > 0 AND item_type = 'gear'
         ORDER BY min_level, shop_price`
      )
      .all();
  }
  if (type) {
    return db
      .prepare('SELECT * FROM item_definitions WHERE shop_price > 0 AND item_type = ? ORDER BY shop_price')
      .all(type);
  }
  return db
    .prepare('SELECT * FROM item_definitions WHERE shop_price > 0 ORDER BY item_type, min_level, shop_price')
    .all();
}

export function shopListArmory() {
  return shopList('armory');
}

export function shopBuy(discordId, username, itemId, quantity = 1) {
  const player = getOrCreatePlayer(discordId, username);
  const block = isBlocked(player);
  if (block.blocked && block.reason === 'jail') {
    return { ok: false, message: 'Cannot shop while in the Black Cells.' };
  }
  const db = getDb();
  const item = db.prepare('SELECT * FROM item_definitions WHERE id = ?').get(itemId);
  if (!item) return { ok: false, message: 'Item not found.' };
  const minLevel = item.min_level ?? 1;
  const lvl = requireLevel(player, minLevel, item.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  quantity = Math.max(1, Math.min(99, quantity));
  const cost = item.shop_price * quantity;
  if (player.coins < cost) return { ok: false, message: `Need ${cost} coins.` };
  const effects = JSON.parse(item.effects_json || '{}');
  if (effects.ceCapBonus) {
    if (quantity !== 1) return { ok: false, message: 'Cap relics can only be bought one at a time.' };
    const bonus = balance.capBonusAmount ?? 25;
    if (!canBuyCapBonus(player, 'ce')) {
      return { ok: false, message: 'You already hold a Battlehorn — morale cap is maxed (+25).' };
    }
    db.prepare('UPDATE players SET coins = coins - ?, ce_cap_bonus = ? WHERE id = ?').run(
      cost,
      bonus,
      player.id
    );
    audit(db, player.id, 'shop_cap_upgrade', cost, { itemId, kind: 'morale' });
    return {
      ok: true,
      message: `Purchased ${item.name}! Morale regen cap ${100 + bonus}, overflow cap ${200 + bonus}.`,
      player: getOrCreatePlayer(discordId, username)
    };
  }
  if (effects.focusCapBonus) {
    if (quantity !== 1) return { ok: false, message: 'Cap relics can only be bought one at a time.' };
    const bonus = balance.capBonusAmount ?? 25;
    if (!canBuyCapBonus(player, 'focus')) {
      return { ok: false, message: "You already wear the Maester's Focus Crown — focus cap is maxed (+25)." };
    }
    db.prepare('UPDATE players SET coins = coins - ?, focus_cap_bonus = ? WHERE id = ?').run(
      cost,
      bonus,
      player.id
    );
    audit(db, player.id, 'shop_cap_upgrade', cost, { itemId, kind: 'focus' });
    return {
      ok: true,
      message: `Purchased ${item.name}! Focus regen cap ${100 + bonus}, overflow cap ${200 + bonus}.`,
      player: getOrCreatePlayer(discordId, username)
    };
  }
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(cost, player.id);
  addItem(player.id, itemId, quantity);
  audit(db, player.id, 'shop_buy', cost, { itemId, quantity });
  return {
    ok: true,
    message: `Bought ${quantity}x ${item.name} for ${cost} coins.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function shopBuyAndEquip(discordId, username, itemId) {
  const buy = shopBuy(discordId, username, itemId, 1);
  if (!buy.ok) return buy;
  const db = getDb();
  const item = db.prepare('SELECT item_type FROM item_definitions WHERE id = ?').get(itemId);
  if (item && slotForItem(item.item_type)) {
    return equipItem(discordId, username, itemId);
  }
  return buy;
}

export function work(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  if (player.company_id) return companyWork(discordId, username);
  const block = isBlocked(player);
  if (block.blocked) return { ok: false, message: 'Cannot work while hospitalized or jailed.' };
  const db = getDb();
  const jobId = resolveJobId(player);
  const job = db.prepare('SELECT * FROM job_definitions WHERE id = ?').get(jobId);
  if (!job) return { ok: false, message: 'No job. Use /job set <id>.' };
  const lvl = requireLevel(player, job.min_level, job.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  if (player.last_work_at) {
    const cooldownMs = balance.workCooldownMinutes * 60000 * (1 - getWorkCooldownReduction(player, db));
    const next = new Date(player.last_work_at).getTime() + cooldownMs;
    if (Date.now() < next) {
      const mins = Math.ceil((next - Date.now()) / 60000);
      return { ok: false, message: `Work cooldown: ${mins}m remaining.` };
    }
  }
  const workerStat = JOB_WORKER_STAT[jobId] || 'manual_labor';
  const statVal = getEffectiveWorkerStats(player, db)[workerStat] ?? 10;
  const statFactor = balance.stats?.workStatFactor ?? 0.008;
  const coinPayout = Math.floor(job.coin_payout * (1 + statVal * statFactor));
  const xpPayout = computeScaledXp(
    Math.floor(job.xp_payout * (1 + statVal * (statFactor * 0.5))),
    player,
    'work'
  );
  db.prepare(
    `UPDATE players SET coins = coins + ?, xp = xp + ?, last_work_at = datetime('now') WHERE id = ?`
  ).run(coinPayout, xpPayout, player.id);
  applyLevelUps(db, { ...player, xp: player.xp + xpPayout });
  audit(db, player.id, 'work', coinPayout, { jobId, workerStat, statVal });
  return {
    ok: true,
    message: `${job.name}: +${coinPayout} coins, +${xpPayout} XP (${workerStat} ${statVal} helped).`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function setJob(discordId, username, jobId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  jobId = resolveLegacyId(jobId);
  const job = db.prepare('SELECT * FROM job_definitions WHERE id = ?').get(jobId);
  if (!job) return { ok: false, message: `Jobs: ${JOB_LIST_HINT}.` };
  const lvl = requireLevel(player, job.min_level, job.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  db.prepare('UPDATE players SET job_id = ? WHERE id = ?').run(jobId, player.id);
  return { ok: true, message: `Job set to ${job.name}.`, player: getOrCreatePlayer(discordId, username) };
}

export function useItem(discordId, username, itemId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const inv = getInventory(player.id).find((i) => i.item_id === resolveLegacyId(itemId) || i.item_id === itemId);
  itemId = inv?.item_id || resolveLegacyId(itemId);
  if (!inv || inv.quantity < 1) return { ok: false, message: 'Item not in inventory.' };
  const effects = JSON.parse(inv.effects_json || '{}');
  if (effects.hospitalClear && player.hospital_until) {
    removeItem(player.id, itemId, 1);
    db.prepare('UPDATE players SET hospital_until = NULL, hp = max_hp WHERE id = ?').run(player.id);
    return { ok: true, message: 'Healer\'s kit used. Released from the maester\'s tent!', player: getOrCreatePlayer(discordId, username) };
  }
  if (effects.jailClear && player.jail_until) {
    removeItem(player.id, itemId, 1);
    db.prepare('UPDATE players SET jail_until = NULL WHERE id = ?').run(player.id);
    return { ok: true, message: 'Dungeon key used. You are free from the Black Cells!', player: getOrCreatePlayer(discordId, username) };
  }
  if (effects.grabBag) {
    return openGrabBag(discordId, username, true);
  }
  const fresh = db.prepare('SELECT * FROM players WHERE id = ?').get(player.id);
  if (effects.ce) {
    removeItem(player.id, itemId, 1);
    db.prepare('UPDATE players SET ce = ? WHERE id = ?').run(clampMorale(fresh.ce + effects.ce, fresh), player.id);
    return { ok: true, message: `Used ${inv.name}. +${effects.ce} morale.`, player: getOrCreatePlayer(discordId, username) };
  }
  if (effects.focus) {
    removeItem(player.id, itemId, 1);
    db.prepare('UPDATE players SET focus = ? WHERE id = ?').run(clampFocus(fresh.focus + effects.focus, fresh), player.id);
    return { ok: true, message: `Used ${inv.name}. +${effects.focus} focus.`, player: getOrCreatePlayer(discordId, username) };
  }
  return { ok: false, message: 'This item cannot be used right now.' };
}
