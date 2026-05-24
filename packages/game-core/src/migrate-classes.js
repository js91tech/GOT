/** Add class_id column for GoT class progression tree. */
export function migrateClasses(db) {
  try {
    db.exec("ALTER TABLE players ADD COLUMN class_id TEXT NOT NULL DEFAULT 'squire'");
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
  db.prepare("UPDATE players SET class_id = 'squire' WHERE class_id IS NULL OR class_id = ''").run();
  db.prepare('UPDATE players SET level = 50, xp = 0 WHERE level > 50').run();
}
