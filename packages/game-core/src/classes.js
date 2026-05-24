import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getOrCreatePlayer } from './player.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASSES = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/classes.json'), 'utf8'));

const XP_CONTEXT_KEYS = {
  general: 'xpMult',
  duel: 'duelXpMult',
  pve: 'pveXpMult',
  crime: 'crimeXpMult',
  train: 'trainXpMult',
  work: 'workXpMult'
};

export function getAllClasses() {
  return CLASSES;
}

export function getClass(classId) {
  return CLASSES[classId || 'squire'] || CLASSES.squire;
}

export function getClassPath(classId) {
  const pathIds = [];
  let cur = classId || 'squire';
  const seen = new Set();
  while (cur && CLASSES[cur] && !seen.has(cur)) {
    pathIds.unshift(cur);
    seen.add(cur);
    cur = CLASSES[cur].parent;
  }
  return pathIds.map((id) => CLASSES[id]);
}

function mergeEffectBlock(target, source, isPenalty = false) {
  if (!source) return;
  for (const [key, val] of Object.entries(source)) {
    if (key.endsWith('Mult')) {
      target[key] = (target[key] ?? 1) * val;
    } else {
      target[key] = (target[key] ?? 0) + (isPenalty ? -val : val);
    }
  }
}

export function getMergedClassBonuses(classId) {
  const merged = {};
  for (const cls of getClassPath(classId)) {
    mergeEffectBlock(merged, cls.bonuses, false);
    mergeEffectBlock(merged, cls.penalties, true);
  }
  return merged;
}

export function getClassStatBonuses(player) {
  const b = getMergedClassBonuses(player.class_id || 'squire');
  return {
    strength: b.strength || 0,
    defense: b.defense || 0,
    speed: b.speed || 0,
    dexterity: b.dexterity || 0,
    manual_labor: b.manual_labor || 0,
    intelligence: b.intelligence || 0,
    endurance: b.endurance || 0,
    technique: b.technique || 0,
    max_hp: b.max_hp || 0
  };
}

export function getClassXpMultiplier(player, context = 'general') {
  const b = getMergedClassBonuses(player.class_id || 'squire');
  const specific = XP_CONTEXT_KEYS[context] ? b[XP_CONTEXT_KEYS[context]] : null;
  const general = b.xpMult ?? 1;
  return (specific ?? 1) * general;
}

export function getClassModifier(player, key, defaultVal = 1) {
  const b = getMergedClassBonuses(player.class_id || 'squire');
  return b[key] ?? defaultVal;
}

export function getChildClasses(classId) {
  return Object.values(CLASSES).filter((c) => c.parent === (classId || 'squire'));
}

export function hasAdvancedClass(classId) {
  return getChildClasses(classId).length > 0;
}

/** True when player reached the next tier but has not chosen a specialization. */
export function getClassMilestone(player) {
  const currentId = player.class_id || 'squire';
  const children = getChildClasses(currentId);
  if (!children.length) return null;
  const nextLevel = Math.min(...children.map((c) => c.minLevel));
  if (player.level < nextLevel) return null;
  const options = children.filter((c) => player.level >= c.minLevel);
  if (!options.length) return null;
  return {
    due: true,
    current: getClass(currentId),
    nextLevel,
    options: options.map((o) => ({
      ...o,
      effectSummary: formatClassBonuses(getMergedClassBonuses(o.id))
    }))
  };
}

export function getClassProgress(player) {
  const current = getClass(player.class_id || 'squire');
  const path = getClassPath(player.class_id || 'squire');
  const milestone = getClassMilestone(player);
  const bonuses = getMergedClassBonuses(player.class_id || 'squire');
  const children = getChildClasses(player.class_id || 'squire');
  const nextSpecializationLevel = children.length
    ? Math.min(...children.map((c) => c.minLevel))
    : null;
  return {
    current,
    path,
    milestone,
    bonuses,
    bonusSummary: formatClassBonuses(bonuses),
    nextSpecializationLevel,
    atMaxClass: !hasAdvancedClass(player.class_id || 'squire')
  };
}

const MULT_LABELS = {
  duelDamageMult: 'duel damage',
  duelTakenMult: 'damage taken',
  duelXpMult: 'duel XP',
  pveXpMult: 'PvE XP',
  trainXpMult: 'train XP',
  workXpMult: 'work XP',
  crimeXpMult: 'mission XP',
  crimeCoinMult: 'mission coins',
  crimeFailMult: 'mission fail chance',
  mugMult: 'mug haul',
  fleeMult: 'flee chance',
  jailChanceMult: 'jail risk',
  hospitalChanceMult: 'injury risk',
  xpMult: 'all XP'
};

function formatMultLabel(key, mult) {
  if (!mult || mult === 1) return null;
  const label = MULT_LABELS[key] || key;
  const pct = Math.round(Math.abs(mult - 1) * 100);
  if (mult > 1) return `+${pct}% ${label}`;
  return `−${pct}% ${label}`;
}

export function formatClassBonuses(bonuses) {
  const parts = [];
  const statLabels = {
    strength: 'STR',
    defense: 'DEF',
    speed: 'SPD',
    dexterity: 'DEX',
    manual_labor: 'LAB',
    intelligence: 'INT',
    endurance: 'END',
    technique: 'TEC',
    max_hp: 'HP'
  };
  for (const [k, v] of Object.entries(bonuses)) {
    if (k.endsWith('Mult')) continue;
    if (statLabels[k] && v > 0) parts.push(`+${v} ${statLabels[k]}`);
    if (statLabels[k] && v < 0) parts.push(`${v} ${statLabels[k]}`);
  }
  for (const [k, v] of Object.entries(bonuses)) {
    if (!k.endsWith('Mult')) continue;
    const line = formatMultLabel(k, v);
    if (line) parts.push(line);
  }
  return parts.join(' · ') || 'Balanced — no modifiers yet';
}

export function chooseClass(discordId, username, classId) {
  const player = getOrCreatePlayer(discordId, username);
  const target = CLASSES[classId];
  if (!target) return { ok: false, message: 'Unknown class path.' };
  if (player.level < target.minLevel) {
    return { ok: false, message: `${target.name} requires level ${target.minLevel}. You are Lv.${player.level}.` };
  }
  const currentId = player.class_id || 'squire';
  if (target.parent !== currentId) {
    return {
      ok: false,
      message: `You must advance from **${getClass(currentId).name}** — that path is not open to you.`
    };
  }
  const db = getDb();
  db.prepare('UPDATE players SET class_id = ? WHERE id = ?').run(classId, player.id);
  const next = getClassMilestone(getOrCreatePlayer(discordId, username));
  let msg = `You have sworn the path of **${target.icon} ${target.name}**. ${target.description}`;
  const bonusLine = formatClassBonuses(getMergedClassBonuses(classId));
  if (bonusLine !== 'No bonuses yet') msg += `\nBonuses (total path): ${bonusLine}.`;
  if (next?.due) {
    msg += `\nAt Lv.${next.nextLevel}+ you may choose your next specialization on /class or the character page.`;
  }
  return { ok: true, message: msg, player: getOrCreatePlayer(discordId, username) };
}

export function listClassOptions(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  return getClassProgress(player);
}
