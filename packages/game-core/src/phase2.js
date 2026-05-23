import { getDb } from './db.js';
import { getOrCreatePlayer, addItem, removeItem } from './player.js';
import { audit, requireLevel } from './util.js';
import { forgeRecipe } from './recipes.js';

export function listEducation() {
  return getDb().prepare('SELECT * FROM education_courses ORDER BY min_level').all();
}

export function enrollEducation(discordId, username, courseId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const course = db.prepare('SELECT * FROM education_courses WHERE id = ?').get(courseId);
  if (!course) return { ok: false, message: 'Unknown course.' };
  const edu = JSON.parse(player.education_json || '[]');
  if (edu.includes(courseId)) return { ok: false, message: 'Already enrolled.' };
  const lvl = requireLevel(player, course.min_level, course.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  if (player.coins < course.cost) return { ok: false, message: `Costs ${course.cost} coins.` };
  edu.push(courseId);
  db.prepare('UPDATE players SET coins = coins - ?, education_json = ? WHERE id = ?').run(
    course.cost,
    JSON.stringify(edu),
    player.id
  );
  return {
    ok: true,
    message: `Enrolled in ${course.name}!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function listClans() {
  return getDb().prepare('SELECT * FROM clans').all();
}

export function joinClan(discordId, username, clanId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const clan = db.prepare('SELECT * FROM clans WHERE id = ?').get(clanId);
  if (!clan) return { ok: false, message: 'Clans: tokyo, kyoto, zenin' };
  db.prepare('UPDATE players SET clan_id = ? WHERE id = ?').run(clanId, player.id);
  return { ok: true, message: `Joined ${clan.name}!`, player: getOrCreatePlayer(discordId, username) };
}

export function clanDeposit(discordId, username, amount) {
  const player = getOrCreatePlayer(discordId, username);
  if (!player.clan_id) return { ok: false, message: 'Not in a clan.' };
  amount = Math.floor(amount);
  if (amount <= 0 || player.coins < amount) return { ok: false, message: 'Invalid amount.' };
  const db = getDb();
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(amount, player.id);
  db.prepare('UPDATE clans SET bank_balance = bank_balance + ? WHERE id = ?').run(amount, player.clan_id);
  return { ok: true, message: `Deposited ${amount} to clan vault.`, player: getOrCreatePlayer(discordId, username) };
}

export function listEstates() {
  return getDb().prepare('SELECT * FROM estate_tiers ORDER BY tier').all();
}

export function buyEstate(discordId, username, tier) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const estate = db.prepare('SELECT * FROM estate_tiers WHERE tier = ?').get(tier);
  if (!estate) return { ok: false, message: 'Invalid estate tier.' };
  if (player.estate_tier >= tier) return { ok: false, message: 'Already own equal or better housing.' };
  if (player.coins < estate.cost) return { ok: false, message: `Need ${estate.cost} coins.` };
  db.prepare('UPDATE players SET coins = coins - ?, estate_tier = ? WHERE id = ?').run(
    estate.cost,
    tier,
    player.id
  );
  return {
    ok: true,
    message: `Purchased ${estate.name}! Train multiplier x${estate.train_multiplier}.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function marketList(discordId, username, itemId, quantity, price) {
  const player = getOrCreatePlayer(discordId, username);
  quantity = Math.floor(quantity);
  price = Math.floor(price);
  if (quantity < 1 || price < 1) return { ok: false, message: 'Invalid listing.' };
  if (!removeItem(player.id, itemId, quantity)) {
    return { ok: false, message: 'Not enough items.' };
  }
  getDb()
    .prepare(
      `INSERT INTO market_listings (seller_id, item_id, quantity, price) VALUES (?, ?, ?, ?)`
    )
    .run(player.id, itemId, quantity, price);
  return {
    ok: true,
    message: `Listed ${quantity}x ${itemId} for ${price} coins. Do not log out with coins exposed!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function marketBrowse() {
  return getDb()
    .prepare(
      `SELECT m.*, p.username, i.name FROM market_listings m
       JOIN players p ON p.id = m.seller_id
       JOIN item_definitions i ON i.id = m.item_id
       ORDER BY m.listed_at DESC LIMIT 30`
    )
    .all();
}

export function marketBuy(discordId, username, listingId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const listing = db.prepare('SELECT * FROM market_listings WHERE id = ?').get(listingId);
  if (!listing) return { ok: false, message: 'Listing not found.' };
  if (listing.seller_id === player.id) return { ok: false, message: 'Cannot buy your own listing.' };
  if (player.coins < listing.price) return { ok: false, message: 'Not enough coins.' };
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(listing.price, player.id);
  db.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').run(listing.price, listing.seller_id);
  addItem(player.id, listing.item_id, listing.quantity);
  db.prepare('DELETE FROM market_listings WHERE id = ?').run(listingId);
  audit(db, player.id, 'market_buy', listing.price, { listingId });
  return {
    ok: true,
    message: `Purchased listing #${listingId}!`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function goldList(discordId, username, goldAmount, price) {
  const player = getOrCreatePlayer(discordId, username);
  goldAmount = Math.floor(goldAmount);
  price = Math.floor(price);
  if (goldAmount < 1 || player.gold_objects < goldAmount) return { ok: false, message: 'Not enough gold objects.' };
  const db = getDb();
  db.prepare('UPDATE players SET gold_objects = gold_objects - ? WHERE id = ?').run(goldAmount, player.id);
  db.prepare(
    `INSERT INTO gold_market_listings (seller_id, gold_amount, price) VALUES (?, ?, ?)`
  ).run(player.id, goldAmount, price);
  return { ok: true, message: 'Listed on Cursed Object exchange.', player: getOrCreatePlayer(discordId, username) };
}

export function goldBrowse() {
  return getDb()
    .prepare(
      `SELECT g.*, p.username FROM gold_market_listings g JOIN players p ON p.id = g.seller_id LIMIT 20`
    )
    .all();
}

export function goldBuy(discordId, username, listingId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const listing = db.prepare('SELECT * FROM gold_market_listings WHERE id = ?').get(listingId);
  if (!listing || player.coins < listing.price) return { ok: false, message: 'Cannot buy.' };
  db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(listing.price, player.id);
  db.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').run(listing.price, listing.seller_id);
  db.prepare('UPDATE players SET gold_objects = gold_objects + ? WHERE id = ?').run(
    listing.gold_amount,
    player.id
  );
  db.prepare('DELETE FROM gold_market_listings WHERE id = ?').run(listingId);
  return { ok: true, message: 'Purchased cursed objects!', player: getOrCreatePlayer(discordId, username) };
}

export function forge(discordId, username, recipeId = 'cursed_blade') {
  return forgeRecipe(discordId, username, recipeId);
}

export function listCommodities() {
  return getDb().prepare('SELECT * FROM commodities').all();
}

export function tradeCommodity(discordId, username, commodityId, quantity, action) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const comm = db.prepare('SELECT * FROM commodities WHERE id = ?').get(commodityId);
  if (!comm) return { ok: false, message: 'Unknown commodity.' };
  quantity = Math.floor(quantity);
  if (quantity < 1) return { ok: false, message: 'Invalid quantity.' };
  const row = db
    .prepare('SELECT quantity FROM player_commodities WHERE player_id = ? AND commodity_id = ?')
    .get(player.id, commodityId);
  const owned = row?.quantity || 0;
  if (action === 'buy') {
    const cost = comm.current_price * quantity;
    if (player.coins < cost) return { ok: false, message: `Need ${cost} coins.` };
    db.prepare('UPDATE players SET coins = coins - ? WHERE id = ?').run(cost, player.id);
    db.prepare(
      `INSERT INTO player_commodities (player_id, commodity_id, quantity) VALUES (?, ?, ?)
       ON CONFLICT(player_id, commodity_id) DO UPDATE SET quantity = quantity + ?`
    ).run(player.id, commodityId, quantity, quantity);
    return { ok: true, message: `Bought ${quantity} ${comm.name}.`, player: getOrCreatePlayer(discordId, username) };
  }
  if (action === 'sell') {
    if (owned < quantity) return { ok: false, message: 'Not enough held.' };
    const gain = comm.current_price * quantity;
    db.prepare('UPDATE players SET coins = coins + ? WHERE id = ?').run(gain, player.id);
    if (owned === quantity) {
      db.prepare('DELETE FROM player_commodities WHERE player_id = ? AND commodity_id = ?').run(
        player.id,
        commodityId
      );
    } else {
      db.prepare(
        'UPDATE player_commodities SET quantity = quantity - ? WHERE player_id = ? AND commodity_id = ?'
      ).run(quantity, player.id, commodityId);
    }
    return { ok: true, message: `Sold for ${gain} coins.`, player: getOrCreatePlayer(discordId, username) };
  }
  return { ok: false, message: 'Use buy or sell.' };
}
