import { getDb } from './db.js';
import { getOrCreatePlayer } from './player.js';
import { audit } from './util.js';

export function listDrugs() {
  return getDb().prepare('SELECT * FROM drug_definitions ORDER BY cost').all();
}

export function useDrug(discordId, username, drugId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const drug = db.prepare('SELECT * FROM drug_definitions WHERE id = ?').get(drugId);
  if (!drug) return { ok: false, message: 'Drugs: ce_shot, focus_tea, resolve_pill, booster_serum' };
  const cooldowns = JSON.parse(player.drug_cooldowns_json || '{}');
  const until = cooldowns[drugId];
  if (until && new Date(until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(until).getTime() - Date.now()) / 60000);
    return { ok: false, message: `${drug.name} on cooldown (${mins}m).` };
  }
  if (player.coins < drug.cost) return { ok: false, message: `Costs ${drug.cost} coins.` };
  const effects = JSON.parse(drug.effects_json || '{}');
  const updates = ['coins = coins - ?'];
  const params = [drug.cost];
  if (effects.ce) {
    updates.push('ce = MIN(100, ce + ?)');
    params.push(effects.ce);
  }
  if (effects.focus) {
    updates.push('focus = MIN(100, focus + ?)');
    params.push(effects.focus);
  }
  if (effects.resolve) {
    updates.push('resolve = MIN(100, resolve + ?)');
    params.push(effects.resolve);
  }
  if (effects.bravery) {
    updates.push('bravery = MIN(100, bravery + ?)');
    params.push(effects.bravery);
  }
  for (const stat of ['strength', 'defense', 'speed', 'dexterity']) {
    if (effects[stat]) {
      updates.push(`${stat} = ${stat} + ?`);
      params.push(effects[stat]);
    }
  }
  params.push(player.id);
  db.prepare(`UPDATE players SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  cooldowns[drugId] = new Date(Date.now() + drug.cooldown_minutes * 60000).toISOString();
  db.prepare('UPDATE players SET drug_cooldowns_json = ? WHERE id = ?').run(JSON.stringify(cooldowns), player.id);
  audit(db, player.id, 'drug', drug.cost, { drugId });
  return {
    ok: true,
    message: `Used **${drug.name}**: ${drug.description}`,
    player: getOrCreatePlayer(discordId, username)
  };
}
