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

test('explore move returns risk line', async () => {
  const { exploreStatus } = await import('./explore.js');
  const { getOrCreatePlayer } = await import('./player.js');
  const uid = 'pve-status-user';
  getOrCreatePlayer(uid, 'Scout');
  const status = exploreStatus(uid, 'Scout');
  assert.equal(status.ok, true);
  assert.ok(status.message.includes('PvE risk'));
});
