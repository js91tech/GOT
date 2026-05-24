/** Schema v13 — daily quests + focus regen timestamp. */
export function migrateDailyQuests(db) {
  try {
    db.exec("ALTER TABLE players ADD COLUMN focus_updated_at TEXT NOT NULL DEFAULT ''");
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE players ADD COLUMN daily_quest_date TEXT');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec("ALTER TABLE players ADD COLUMN daily_quest_state_json TEXT NOT NULL DEFAULT '{}'");
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  try {
    db.exec('ALTER TABLE players ADD COLUMN investment_return_mult REAL');
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  db.prepare("UPDATE players SET focus_updated_at = energy_updated_at WHERE focus_updated_at IS NULL OR focus_updated_at = ''").run();
}
