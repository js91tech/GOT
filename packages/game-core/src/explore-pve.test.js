import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDb = path.join(__dirname, '../../../data/test-pve.db');

before(async () => {
  process.env.DATABASE_PATH = testDb;
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  try {
    const { closeDb } = await import('./db.js');
    closeDb();
  } catch {
    /* first import */
  }
});

after(async () => {
  const { closeDb } = await import('./db.js');
  closeDb();
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
});

test('PVE encounter creates pending state', async () => {
  const { tryPveEncounter, getPendingEncounter } = await import('./explore-pve.js');
  const { getOrCreatePlayer } = await import('./player.js');
  const uid = 'pve-pending-user';
  const player = getOrCreatePlayer(uid, 'Tester');
  const result = tryPveEncounter(uid, 'Tester', {
    areaId: 'winterfell',
    room: { encounter_mult: 1.5 },
    force: true
  });
  assert.ok(result?.pending);
  assert.ok(result.message.includes('encountered'));
  const pending = getPendingEncounter(getOrCreatePlayer(uid, 'Tester'));
  assert.ok(pending?.mob);
});

test('PVE attack clears pending', async () => {
  const { tryPveEncounter, pveAttack, getPendingEncounter } = await import('./explore-pve.js');
  const { getOrCreatePlayer } = await import('./player.js');
  const uid = 'pve-attack-user';
  getOrCreatePlayer(uid, 'Fighter');
  tryPveEncounter(uid, 'Fighter', {
    areaId: 'winterfell',
    room: { encounter_mult: 1.5 },
    force: true
  });
  const result = pveAttack(uid, 'Fighter');
  assert.ok(result.message.includes('Victory') || result.message.includes('Defeat'));
  assert.equal(getPendingEncounter(getOrCreatePlayer(uid, 'Fighter')), null);
});

test('PVE flee returns outcome', async () => {
  const { tryPveEncounter, pveFlee } = await import('./explore-pve.js');
  const { getOrCreatePlayer } = await import('./player.js');
  const uid = 'pve-flee-user';
  getOrCreatePlayer(uid, 'Runner');
  tryPveEncounter(uid, 'Runner', {
    areaId: 'winterfell',
    room: { encounter_mult: 1.5 },
    force: true
  });
  const result = pveFlee(uid, 'Runner');
  assert.ok(
    result.message.includes('escape') ||
      result.message.includes('Flee failed') ||
      result.message.includes('Flee failed')
  );
});

test('pickMob returns varied mobs per zone', async () => {
  const { pickMob } = await import('./explore-pve.js');
  const originalRandom = Math.random;
  const rolls = [
    0.05, 0.25, 0.45, 0.65, 0.85, 0.15, 0.35, 0.55, 0.75, 0.95, 0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4,
    0.6, 0.8, 0.12, 0.32, 0.52, 0.72, 0.92, 0.18, 0.38, 0.58, 0.78, 0.98, 0.08, 0.28, 0.48, 0.68,
    0.88, 0.14, 0.34, 0.54, 0.74, 0.94, 0.22
  ];
  let i = 0;
  Math.random = () => rolls[i++ % rolls.length];
  try {
    for (const areaId of ['winterfell', 'kings_landing', 'oldtown', 'the_wall']) {
      const ids = new Set();
      for (let n = 0; n < 40; n++) {
        const mob = pickMob(areaId, 12);
        assert.ok(mob, `expected mob in ${areaId}`);
        ids.add(mob.id);
      }
      assert.ok(
        ids.size >= 2,
        `${areaId}: expected at least 2 mob types, got ${[...ids].join(', ')}`
      );
    }
  } finally {
    Math.random = originalRandom;
  }
});

test('pending encounter stores mob snapshot', async () => {
  const { tryPveEncounter, getPendingEncounter } = await import('./explore-pve.js');
  const { getOrCreatePlayer } = await import('./player.js');
  const { getDb } = await import('./db.js');
  const uid = 'pve-snapshot-user';
  getOrCreatePlayer(uid, 'Snap');
  const result = tryPveEncounter(uid, 'Snap', {
    areaId: 'winterfell',
    room: { encounter_mult: 1 },
    force: true
  });
  assert.ok(result?.mob?.level >= 1);
  const raw = getDb().prepare('SELECT pve_encounter_json FROM players WHERE discord_id = ?').get(uid);
  const stored = JSON.parse(raw.pve_encounter_json);
  assert.ok(stored.mobSnapshot);
  assert.equal(stored.mobSnapshot.id, result.mob.id);
  const pending = getPendingEncounter(getOrCreatePlayer(uid, 'Snap'));
  assert.equal(pending.mob.name, stored.mobSnapshot.name);
});

test('explore move returns risk line', async () => {
  const { exploreStatus } = await import('./explore.js');
  const { getOrCreatePlayer } = await import('./player.js');
  const uid = 'pve-status-user';
  getOrCreatePlayer(uid, 'Scout');
  const status = exploreStatus(uid, 'Scout');
  assert.equal(status.ok, true);
  assert.ok(status.message.includes('PvE risk'));
});
