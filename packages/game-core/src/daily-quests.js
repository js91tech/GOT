import balance from './balance.json' with { type: 'json' };
import { getDb } from './db.js';
import { getOrCreatePlayer } from './player.js';
import { audit, computeScaledXp } from './util.js';

const AUDIT_TO_QUEST = {
  work: 'work',
  company_work: 'work',
  train: 'train',
  worker_train: 'train',
  crime: 'crime',
  wheel: 'wheel',
  pve_win: 'duel',
  attack: 'duel',
  mug: 'duel',
  rob: 'duel'
};

function questPool() {
  return balance.dailyQuests?.pool ?? [
    { id: 'work2', kind: 'work', target: 2, label: 'Clock in twice', coins: 250, xp: 40 },
    { id: 'train3', kind: 'train', target: 3, label: 'Train 3 times', coins: 200, xp: 60 },
    { id: 'crime1', kind: 'crime', target: 1, label: 'Run a realm mission', coins: 300, xp: 50 },
    { id: 'wheel2', kind: 'wheel', target: 2, label: 'Spin the wheel twice', coins: 150, xp: 30 },
    { id: 'duel1', kind: 'duel', target: 1, label: 'Win a duel or PvE fight', coins: 400, xp: 80 }
  ];
}

function pickQuests(count) {
  const pool = [...questPool()];
  const picked = [];
  while (picked.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function parseState(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export function ensureDailyQuests(db, player) {
  const today = new Date().toISOString().slice(0, 10);
  if (player.daily_quest_date === today) return parseState(player.daily_quest_state_json);
  const count = balance.dailyQuests?.count ?? 3;
  const quests = pickQuests(count);
  const state = {
    quests,
    progress: {},
    claimed: []
  };
  db.prepare('UPDATE players SET daily_quest_date = ?, daily_quest_state_json = ? WHERE id = ?').run(
    today,
    JSON.stringify(state),
    player.id
  );
  return state;
}

export function getDailyQuestsForPlayer(player) {
  const db = getDb();
  const state = ensureDailyQuests(db, player);
  return state.quests.map((q) => {
    const prog = state.progress[q.kind] ?? 0;
    const done = prog >= q.target;
    const claimed = state.claimed.includes(q.id);
    return { ...q, progress: prog, done, claimed };
  });
}

export function getDailyQuests(discordId, username) {
  const player = getOrCreatePlayer(discordId, username);
  return getDailyQuestsForPlayer(player);
}

export function bumpDailyQuestFromAudit(db, playerId, auditKind) {
  const kind = AUDIT_TO_QUEST[auditKind];
  if (!kind) return;
  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId);
  if (!player) return;
  const state = ensureDailyQuests(db, player);
  state.progress[kind] = (state.progress[kind] ?? 0) + 1;
  db.prepare('UPDATE players SET daily_quest_state_json = ? WHERE id = ?').run(
    JSON.stringify(state),
    playerId
  );
}

export function claimDailyQuest(discordId, username, questId) {
  const player = getOrCreatePlayer(discordId, username);
  const db = getDb();
  const state = ensureDailyQuests(db, player);
  const quest = state.quests.find((q) => q.id === questId);
  if (!quest) return { ok: false, message: 'Unknown daily quest.' };
  if (state.claimed.includes(questId)) return { ok: false, message: 'Already claimed.' };
  const prog = state.progress[quest.kind] ?? 0;
  if (prog < quest.target) return { ok: false, message: `Progress: ${prog}/${quest.target}.` };
  state.claimed.push(questId);
  const xp = computeScaledXp(quest.xp ?? 30, player, 'general');
  db.prepare('UPDATE players SET coins = coins + ?, xp = xp + ?, daily_quest_state_json = ? WHERE id = ?').run(
    quest.coins ?? 100,
    xp,
    JSON.stringify(state),
    player.id
  );
  audit(db, player.id, 'daily_quest', quest.coins ?? 100, { questId });
  return {
    ok: true,
    message: `Daily quest complete! +${quest.coins} coins, +${xp} XP.`,
    player: getOrCreatePlayer(discordId, username)
  };
}
