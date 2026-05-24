import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getOrCreatePlayer, addItem } from './player.js';
import { audit, minutesFromNow, roll, applyLevelUps, requireLevel, computeScaledXp } from './util.js';
import { EXPLORE_AREAS, EXPLORE_NPCS, resolveLegacyId } from './got-theme.js';
import { tryPveEncounter, formatRiskLine, getPendingEncounter, mustResolveEncounter } from './explore-pve.js';

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
  const areaId = resolveLegacyId(player.explore_area || 'winterfell');
  const roomId = player.explore_room || defaultRoom(areaId);
  const area = areas[areaId];
  if (!area) return { ok: false, message: 'Unknown region.' };
  const room = area.rooms[roomId];
  if (!room) return { ok: false, message: 'Invalid location.' };
  const exits = Object.entries(room.exits || {})
    .map(([dir, dest]) => `${dir} → ${dest}`)
    .join(', ');
  const npcs = (room.npcs || []).map((id) => loadNpcs()[id]?.name || id).join(', ') || 'none';
  const riskLine = formatRiskLine(areaId, room);
  const pending = getPendingEncounter(player);
  let message =
    `**${area.name}** — ${room.emoji || ''} ${room.name}\n${room.description}\n` +
    `${riskLine}\n` +
    `Exits: ${exits || 'none'}\nNPCs: ${npcs}\nMineable: ${room.mineable ? 'yes (/explore mine)' : 'no'}`;
  if (pending) {
    message += `\n\n⚠️ **Engaged:** ${pending.mob.emoji} ${pending.mob.name} (Lv${pending.mob.level}) — attack or flee!`;
  }
  return {
    ok: true,
    message,
    player,
    areaId,
    roomId,
    pendingEncounter: pending,
    encounterPending: Boolean(pending)
  };
}

function appendEncounter(status, discordId, username, areaId, room) {
  const encounter = tryPveEncounter(discordId, username, { areaId, room });
  if (!encounter?.message) return status;
  return {
    ...status,
    message: `${status.message}\n\n${encounter.message}`,
    encounter,
    encounterPending: Boolean(encounter.encounterPending || encounter.pending),
    pendingEncounter: encounter.pending ? { mob: encounter.mob, areaId } : status.pendingEncounter
  };
}

function guardEncounter(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  return mustResolveEncounter(player);
}

export function exploreTravel(discordId, username, areaId) {
  const blocked = guardEncounter(discordId, username);
  if (blocked) return blocked;
  const areas = loadAreas();
  const resolved = resolveLegacyId(areaId);
  if (!areas[resolved]) {
    return { ok: false, message: `Regions: ${EXPLORE_AREAS.join(', ')}` };
  }
  const player = getOrCreatePlayer(discordId, username);
  const area = areas[resolved];
  const lvl = requireLevel(player, area.min_level || 1, area.name);
  if (!lvl.ok) return { ok: false, message: lvl.message };
  const roomId = defaultRoom(resolved);
  getDb().prepare('UPDATE players SET explore_area = ?, explore_room = ? WHERE id = ?').run(
    resolved,
    roomId,
    player.id
  );
  const room = area.rooms[roomId];
  const status = exploreStatus(discordId, username);
  return appendEncounter(status, discordId, username, resolved, room);
}

export function exploreMove(discordId, username, direction) {
  const blocked = guardEncounter(discordId, username);
  if (blocked) return blocked;
  const player = getOrCreatePlayer(discordId, username);
  const areas = loadAreas();
  const areaId = resolveLegacyId(player.explore_area || 'winterfell');
  const roomId = player.explore_room || defaultRoom(areaId);
  const room = areas[areaId]?.rooms?.[roomId];
  if (!room) return { ok: false, message: 'You are lost. Use /explore travel winterfell' };
  const dir = direction.toLowerCase();
  const nextRoom = room.exits?.[dir];
  if (!nextRoom) return { ok: false, message: `No exit ${dir}. Exits: ${Object.keys(room.exits || {}).join(', ')}` };
  getDb().prepare('UPDATE players SET explore_room = ? WHERE id = ?').run(nextRoom, player.id);
  const next = areas[areaId].rooms[nextRoom];
  const status = exploreStatus(discordId, username);
  return appendEncounter(status, discordId, username, areaId, next);
}

export function exploreMine(discordId, username) {
  const blocked = guardEncounter(discordId, username);
  if (blocked) return blocked;
  const player = getOrCreatePlayer(discordId, username);
  const areas = loadAreas();
  const areaId = resolveLegacyId(player.explore_area || 'winterfell');
  const roomId = player.explore_room || defaultRoom(areaId);
  const room = areas[areaId]?.rooms?.[roomId];
  if (!room?.mineable) {
    return { ok: false, message: 'Cannot mine here. Find a mine or godswood (e.g. Northern Mine, Frozen Pass).' };
  }
  if (player.ce < 15) return { ok: false, message: 'Mining costs 15 morale.' };
  const db = getDb();
  db.prepare('UPDATE players SET ce = ce - 15 WHERE id = ?').run(player.id);
  const mats = room.materials || ['iron_ingot'];
  const raw = mats[Math.floor(Math.random() * mats.length)];
  const itemId = resolveLegacyId(raw);
  const qty = roll(0.2) ? 2 : 1;
  addItem(player.id, itemId, qty);
  const coins = Math.floor(50 + Math.random() * 150);
  const mineXp = computeScaledXp(5, player, 'general');
  db.prepare('UPDATE players SET coins = coins + ?, xp = xp + ? WHERE id = ?').run(coins, mineXp, player.id);
  applyLevelUps(db, { ...player, xp: player.xp + mineXp });
  audit(db, player.id, 'explore_mine', coins, { room: roomId, item: itemId });
  return {
    ok: true,
    message: `Mined ${qty}x ${itemId} and +${coins} coins.`,
    player: getOrCreatePlayer(discordId, username)
  };
}

export function talkNpc(discordId, username, npcId, responseIndex = 0) {
  const npcs = loadNpcs();
  const resolved = resolveLegacyId(npcId);
  const npc = npcs[resolved];
  if (!npc) return { ok: false, message: `NPCs: ${EXPLORE_NPCS.join(', ')}` };
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const progress = JSON.parse(player.npc_progress_json || '{}');
  const step = progress[resolved] ?? progress[npcId] ?? 0;
  const dialogue = npc.dialogue?.[String(step)];
  if (!dialogue) {
    return { ok: false, message: `${npc.name} has nothing more to say.` };
  }
  let nextStep = step + 1;
  if (responseIndex > 0 && dialogue.responses?.length) {
    nextStep = Math.min(step + 1, Object.keys(npc.dialogue).length - 1);
  }
  progress[resolved] = nextStep;
  db.prepare('UPDATE players SET npc_progress_json = ? WHERE id = ?').run(JSON.stringify(progress), player.id);
  let bonus = '';
  if (nextStep >= 3 && step < 3) {
    const questXp = computeScaledXp(25, player, 'general');
    db.prepare('UPDATE players SET coins = coins + 200, xp = xp + ? WHERE id = ?').run(questXp, player.id);
    applyLevelUps(db, { ...player, xp: player.xp + questXp });
    bonus = ` Quest bonus: +200 coins, +${questXp} XP!`;
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
  const areaId = resolveLegacyId(player.explore_area || 'winterfell');
  const roomId = player.explore_room || defaultRoom(areaId);
  const npcIds = areas[areaId]?.rooms?.[roomId]?.npcs || [];
  const npcs = loadNpcs();
  const list = npcIds.map((id) => `${id}: ${npcs[id]?.name || id}`).join('\n');
  return { ok: true, message: list || 'No NPCs here.', player };
}
