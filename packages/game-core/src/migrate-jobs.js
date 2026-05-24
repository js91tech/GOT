/** Rename legacy job IDs and refresh job/estate display names (v12). */

const JOB_RENAMES = {
  janitor: 'stable_hand',
  instructor_assistant: 'squire_duty',
  curator: 'relic_keeper'
};

export function migrateJobs(db) {
  for (const [oldId, newId] of Object.entries(JOB_RENAMES)) {
    const oldRow = db.prepare('SELECT * FROM job_definitions WHERE id = ?').get(oldId);
    const newRow = db.prepare('SELECT * FROM job_definitions WHERE id = ?').get(newId);
    if (oldRow && !newRow) {
      db.prepare('UPDATE job_definitions SET id = ? WHERE id = ?').run(newId, oldId);
    } else if (oldRow && newRow) {
      db.prepare('DELETE FROM job_definitions WHERE id = ?').run(oldId);
    }
    db.prepare('UPDATE players SET job_id = ? WHERE job_id = ?').run(newId, oldId);
  }

  const jobs = [
    ['stable_hand', 'Stable Hand', 100, 50, 1],
    ['squire_duty', 'Squire', 500, 200, 5],
    ['relic_keeper', 'Relic Keeper', 2000, 800, 15]
  ];
  const upsert = db.prepare(
    `INSERT INTO job_definitions (id, name, coin_payout, xp_payout, min_level) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, coin_payout = excluded.coin_payout,
       xp_payout = excluded.xp_payout, min_level = excluded.min_level`
  );
  for (const row of jobs) upsert.run(...row);

  db.prepare("UPDATE players SET job_id = 'stable_hand' WHERE job_id IS NULL OR job_id = ''").run();

  const estates = [
    [1, 'Squire Quarters'],
    [2, 'Lordly Chambers'],
    [3, 'Safe House'],
    [4, 'Dragonstone Keep']
  ];
  for (const [tier, name] of estates) {
    db.prepare('UPDATE estate_tiers SET name = ? WHERE tier = ?').run(name, tier);
  }

  const staleJobNames = [
    ['janitor', 'Stable Hand'],
    ['instructor_assistant', 'Squire'],
    ['curator', 'Relic Keeper'],
    ['stable_hand', 'Stable Hand'],
    ['squire_duty', 'Squire'],
    ['relic_keeper', 'Relic Keeper']
  ];
  for (const [id, name] of staleJobNames) {
    db.prepare('UPDATE job_definitions SET name = ? WHERE id = ?').run(name, id);
  }
}
