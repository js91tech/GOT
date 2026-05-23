import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getOrCreatePlayer, addItem } from './player.js';
import { audit, minutesFromNow, roll } from './util.js';
import { applyLevelUps, requireLevel } from './util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let areasCache = null;
let npcsCache = null;

function loadAreas() {
  if (!areasCache) {
    const p = path.join(__dirname, '../data/areas.json');
    areasCache = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return areasCache;
}

function loadNpcs() {
  if (!npcsCache) {
    const p = path.join(__dirname, '../data/npcs.json');
    npcsCache = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return npcsCache;
}

function defaultRoom(areaId) {
  const area = loadAreas()[areaId];
  if (!area) return null;
  return Object.keys(area.rooms)[0];
}

export function exploreStatus(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const areas = loadAreas();
  const areaId = player.explore_area || 'tokyo_jujutsu_high';
  const roomId = player.explore_room || defaultRoom(areaId);
  const area = areas[areaId];
  if (!area) return { ok: false, message: 'Unknown area.' };
  const room = area.rooms[roomId];
  if (!room) return { ok: false, message: 'Invalid room.' };
  const exits = Object.entries(room.exits || {})
    .map(([dir, dest]) => `${dir} → ${dest}`)
    .join(', ');
  const npcs = (room.npcs || []).join(', ') || 'none';
  return {
    ok: true,
    message:
      `**${area.name}** — ${room.emoji || ''} ${room.name}\n${room.description}\n` +
      `Exits: ${exits || 'none'}\nNPCs: ${npcs}\nMineable: ${room.mineable ? 'yes (/explore mine)' : 'no'}`,
    player
  };
}

export function exploreTravel(discordId, username, areaId) {
  const areas = loadAreas();
  if (!areas[areaId]) {
    return { ok: false, message: 'Areas: tokyo_jujutsu_high, shibuya_district, jujutsu_high_kyoto, sakurajima_colony' };
  }
  const player = getOrCreatePlayer(discordId, username);
  const area = areas[areaId];
  const lvl = requireLevel(player, area.min_level || 1, area.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  const roomId = defaultRoom(areaId);
  getDb().prepare('UPDATE players SET explore_area = ?, explore_room = ? WHERE id = ?').run(
    areaId,
    roomId,
    player.id
  );
  return exploreStatus(discordId, username);
}

export function exploreMove(discordId, username, direction) {
  const player = getOrCreatePlayer(discordId, username);
  const areas = loadAreas();
  const areaId = player.explore_area || 'tokyo_jujutsu_high';
  const roomId = player.explore_room || defaultRoom(areaId);
  const room = areas[areaId]?.rooms?.[roomId];
  if (!room) return { ok: false, message: 'You are lost. Use /explore travel tokyo_jujutsu_high' };
  const dir = direction.toLowerCase();
  const nextRoom = room.exits?.[dir];
  if (!nextRoom) return { ok: false, message: `No exit ${dir}. Exits: ${Object.keys(room.exits || {}).join(', ')}` };
  getDb().prepare('UPDATE players SET explore_room = ? WHERE id = ?').run(nextRoom, player.id);
  return exploreStatus(discordId, username);
}

export function exploreMine(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const areas = loadAreas();
  const areaId = player.explore_area || 'tokyo_jujutsu_high';
  const roomId = player.explore_room || defaultRoom(areaId);
  const room = areas[areaId]?.rooms?.[roomId];
  if (!room?.mineable) return { ok: false, message: 'Cannot mine here. Find a mineable room (e.g. cursed_pit).' };
  if (player.ce < 15) return { ok: false, message: 'Mining costs 15 CE.' };
  const db = getDb();
  db.prepare('UPDATE players SET ce = ce - 15 WHERE id = ?').run(player.id);
  const mats = room.materials || ['iron_ore'];
  const itemId = mats[Math.floor(Math.random() * mats.length)];
  const mapped =
    { cursed_residue: 'iron_ore', spirit_fragment: 'spirit_core', bone_shard: 'iron_ore' }[itemId] || itemId;
  const qty = roll(0.2) ? 2 : 1;
  addItem(player.id, mapped, qty);
  const coins = Math.floor(50 + Math.random() * 150);
  db.prepare('UPDATE players SET coins = coins + ?, xp = xp + 5 WHERE id = ?').run(coins, player.id);
  applyLevelUps(db, { ...player, xp: player.xp + 5 });
  audit(db, player.id, 'explore_mine', coins, { room: roomId, item: mapped });
  return {
    ok: true,
    message: `Mined ${qty}x ${mapped} and +${coins} coins.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function talkNpc(discordId, username, npcId, responseIndex = 0) {
  const npcs = loadNpcs();
  const npc = npcs[npcId];
  if (!npc) return { ok: false, message: 'NPCs: gojo, yaga, nanami, maki' };
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const progress = JSON.parse(player.npc_progress_json || '{}');
  const step = progress[npcId] ?? 0;
  const dialogue = npc.dialogue?.[String(step)];
  if (!dialogue) {
    return { ok: false, message: `${npc.name} has nothing more to say.` };
  }
  let nextStep = step + 1;
  if (responseIndex > 0 && dialogue.responses?.length) {
    nextStep = Math.min(step + 1, Object.keys(npc.dialogue).length - 1);
  }
  progress[npcId] = nextStep;
  db.prepare('UPDATE players SET npc_progress_json = ? WHERE id = ?').run(JSON.stringify(progress), player.id);
  let bonus = '';
  if (nextStep >= 3 && step < 3) {
    db.prepare('UPDATE players SET coins = coins + 200, xp = xp + 25 WHERE id = ?').run(player.id);
    bonus = ' Quest bonus: +200 coins, +25 XP!';
  }
  const responses = (dialogue.responses || []).map((r, i) => `[${i + 1}] ${r}`).join('\n');
  return {
    ok: true,
    message: `${npc.emoji} **${npc.name}**: ${dialogue.text}${bonus}${responses ? `\n\n${responses}` : ''}`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function listNpcsInRoom(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  const areas = loadAreas();
  const areaId = player.explore_area || 'tokyo_jujutsu_high';
  const roomId = player.explore_room || defaultRoom(areaId);
  const npcIds = areas[areaId]?.rooms?.[roomId]?.npcs || [];
  const npcs = loadNpcs();
  const list = npcIds.map((id) => `${id}: ${npcs[id]?.name || id}`).join('\n');
  return { ok: true, message: list || 'No NPCs here.', player };
}
