import { test } from 'node:test';
import assert from 'node:assert';
import { xpForLevel, canAttack, gradeName } from './util.js';

test('xpForLevel scales', () => {
  assert.ok(xpForLevel(1) < xpForLevel(10));
});

test('gradeName tiers', () => {
  assert.equal(gradeName(1), 'Squire');
  assert.equal(gradeName(5), 'Sworn Sword');
  assert.equal(gradeName(50), 'Warden of the Realm');
});

test('grade protection blocks bully', () => {
  const attacker = { id: 1, level: 50, username: 'A' };
  const defender = { id: 2, level: 5, username: 'B' };
  const r = canAttack(attacker, defender);
  assert.equal(r.ok, false);
});
