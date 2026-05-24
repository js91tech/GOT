/** v8 — pending PvE encounter state (attack / flee choice). */
export function migratePveEncounter(db) {
  try {
    db.exec("ALTER TABLE players ADD COLUMN pve_encounter_json TEXT NOT NULL DEFAULT ''");
  } catch (e) {
    if (!String(e.message).includes('duplicate column')) throw e;
  }
}
