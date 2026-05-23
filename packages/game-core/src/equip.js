import { getDb } from './db.js';
import { getOrCreatePlayer, getInventory } from './player.js';
import { audit } from './util.js';

const SLOT_BY_TYPE = {
  weapon: 'weapon',
  armor: 'armor',
  gear: 'gear'
};

export function slotForItem(itemType) {
  return SLOT_BY_TYPE[itemType] || (itemType === 'consumable' ? null : 'gear');
}

export function equipItem(discordId, username, itemId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const inv = getInventory(player.id).find((i) => i.item_id === itemId);
  if (!inv || inv.quantity < 1) return { ok: false, message: 'Item not in inventory.' };
  const slot = slotForItem(inv.item_type);
  if (!slot) return { ok: false, message: 'This item cannot be equipped.' };
  db.prepare(
    `UPDATE inventory_items SET equip_slot = NULL WHERE player_id = ? AND equip_slot = ?`
  ).run(player.id, slot);
  db.prepare(
    `UPDATE inventory_items SET equip_slot = ? WHERE player_id = ? AND item_id = ?`
  ).run(slot, player.id, itemId);
  audit(db, player.id, 'equip', 0, { itemId, slot });
  return {
    ok: true,
    message: `Equipped **${inv.name}** (${slot}).`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function unequipSlot(discordId, username, slot) {
  const player = getOrCreatePlayer(discordId, username);
  const allowed = ['weapon', 'armor', 'gear'];
  if (!allowed.includes(slot)) return { ok: false, message: 'Slots: weapon, armor, gear' };
  const db = getDb();
  const row = db
    .prepare('SELECT item_id FROM inventory_items WHERE player_id = ? AND equip_slot = ?')
    .get(player.id, slot);
  if (!row) return { ok: false, message: `Nothing equipped in ${slot}.` };
  db.prepare('UPDATE inventory_items SET equip_slot = NULL WHERE player_id = ? AND equip_slot = ?').run(
    player.id,
    slot
  );
  return {
    ok: true,
    message: `Unequipped ${slot}.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function getEquippedSummary(playerId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT inv.equip_slot, i.name, i.effects_json FROM inventory_items inv
       JOIN item_definitions i ON i.id = inv.item_id
       WHERE inv.player_id = ? AND inv.equip_slot IS NOT NULL`
    )
    .all(playerId);
}
