/** Schema v13 — daily quests + focus regen timestamp. */
function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

function addColumn(db, table, column, ddl) {
  if (hasColumn(db, table, column)) return;
  db.exec(ddl);
}

export function migrateDailyQuests(db) {
  // SQLite ALTER TABLE only allows constant defaults; avoid DEFAULT (datetime('now')).
  addColumn(db, 'players', 'focus_updated_at', 'ALTER TABLE players ADD COLUMN focus_updated_at TEXT');
  addColumn(db, 'players', 'daily_quest_date', 'ALTER TABLE players ADD COLUMN daily_quest_date TEXT');
  addColumn(db, 'players', 'daily_quest_state_json', 'ALTER TABLE players ADD COLUMN daily_quest_state_json TEXT');
  addColumn(db, 'players', 'investment_return_mult', 'ALTER TABLE players ADD COLUMN investment_return_mult REAL');

  db.prepare(
    `UPDATE players SET focus_updated_at = energy_updated_at
     WHERE focus_updated_at IS NULL OR focus_updated_at = ''`
  ).run();
  db.prepare(
    `UPDATE players SET daily_quest_state_json = '{}'
     WHERE daily_quest_state_json IS NULL OR daily_quest_state_json = ''`
  ).run();
}
