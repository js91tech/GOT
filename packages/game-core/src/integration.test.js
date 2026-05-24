import { test, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDb = path.join(__dirname, '../../../data/test-westeros.db');

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

test('full MVP loop', async () => {
  const { GameService, closeDb } = await import('./index.js');
  const a = 'user-a-test';
  const b = 'user-b-test';
  GameService.profile(a, 'Tyrion');
  GameService.profile(b, 'Arya');
  const train = GameService.train(a, 'Tyrion', 2, 'strength');
  assert.equal(train.ok, true);
  const trainDef = GameService.train(a, 'Tyrion', 1, 'defense');
  assert.equal(trainDef.ok, true);
  const prof = GameService.profile(a, 'Tyrion');
  assert.ok(prof.player.defense >= 12);
  const work = GameService.work(a, 'Tyrion');
  assert.equal(work.ok, true);
  const crime = GameService.crime(a, 'Tyrion', 'petty_raid');
  assert.equal(crime.ok, true);
  const wheel = GameService.wheel(a, 'Tyrion');
  assert.equal(wheel.ok, true);
  GameService.bank(a, 'Tyrion', 'deposit', 100);
  closeDb();
});
