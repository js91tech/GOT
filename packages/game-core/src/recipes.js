import { getDb } from './db.js';
import { getOrCreatePlayer, addItem, removeItem } from './player.js';
import { audit } from './util.js';

export function listRecipes() {
  return getDb().prepare('SELECT * FROM forge_recipes ORDER BY coin_cost').all();
}

export function forgeRecipe(discordId, username, recipeId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const recipe = db.prepare('SELECT * FROM forge_recipes WHERE id = ?').get(recipeId);
  if (!recipe) return { ok: false, message: 'Recipes: valyrian_steel, war_spear, plate_vest, sigil_charm' };
  const mats = JSON.parse(recipe.materials_json || '{}');
  for (const [itemId, qty] of Object.entries(mats)) {
    if (!removeItem(player.id, itemId, qty)) {
      return { ok: false, message: `Need ${qty}x ${itemId}.` };
    }
  }
  if (player.coins < recipe.coin_cost) return { ok: false, message: `Costs ${recipe.coin_cost} coins.` };
  if (player.ce < recipe.ce_cost) return { ok: false, message: `Costs ${recipe.ce_cost} Morale.` };
  db.prepare('UPDATE players SET coins = coins - ?, ce = ce - ? WHERE id = ?').run(
    recipe.coin_cost,
    recipe.ce_cost,
    player.id
  );
  addItem(player.id, recipe.output_item, 1);
  audit(db, player.id, 'forge', recipe.coin_cost, { recipeId });
  return {
    ok: true,
    message: `Forged **${recipe.name}**! Equip with /equip ${recipe.output_item}`,
    player: getOrCreatePlayer(discordId, username)
  };
}
