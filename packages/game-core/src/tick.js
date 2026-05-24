import { getDb } from './db.js';
import balance from './balance.json' with { type: 'json' };
import { nowIso } from './util.js';
import { applyMoraleRegen } from './energy.js';
import { processSiegesAndYields } from './territory.js';

let schedulerStarted = false;

export function processTicks(player) {
  const db = getDb();
  let p = { ...player };
  const now = Date.now();
  const updatedAt = new Date(p.energy_updated_at || nowIso()).getTime();
  const intervalMs = balance.ceRegenMinutes * 60 * 1000;
  const elapsed = now - updatedAt;
  if (elapsed >= intervalMs) {
    const ticks = Math.floor(elapsed / intervalMs);
    const newCe = applyMoraleRegen(p.ce, ticks * balance.ceRegenAmount, p);
    const newUpdated = new Date(updatedAt + ticks * intervalMs).toISOString();
    db.prepare('UPDATE players SET ce = ?, energy_updated_at = ? WHERE id = ?').run(
      newCe,
      newUpdated,
      p.id
    );
    p.ce = newCe;
    p.energy_updated_at = newUpdated;
  }
  if (p.hospital_until && new Date(p.hospital_until).getTime() <= now) {
    db.prepare('UPDATE players SET hospital_until = NULL WHERE id = ?').run(p.id);
    p.hospital_until = null;
  }
  if (p.jail_until && new Date(p.jail_until).getTime() <= now) {
    db.prepare('UPDATE players SET jail_until = NULL WHERE id = ?').run(p.id);
    p.jail_until = null;
  }
  const today = new Date().toISOString().slice(0, 10);
  if (p.wheel_spin_date !== today) {
    db.prepare('UPDATE players SET wheel_spins_today = 0, wheel_spin_date = ? WHERE id = ?').run(
      today,
      p.id
    );
    p.wheel_spins_today = 0;
    p.wheel_spin_date = today;
  }
  return db.prepare('SELECT * FROM players WHERE id = ?').get(p.id);
}

export function startTickScheduler(intervalMs = 60000) {
  if (schedulerStarted) return () => {};
  schedulerStarted = true;
  const id = setInterval(() => {
    const db = getDb();
    const players = db.prepare('SELECT id FROM players').all();
    for (const { id: pid } of players) {
      const p = db.prepare('SELECT * FROM players WHERE id = ?').get(pid);
      if (p) processTicks(p);
    }
    applyBankInterest();
    fluctuateCommodities();
    processSiegesAndYields();
  }, intervalMs);
  return () => clearInterval(id);
}

function applyBankInterest() {
  const db = getDb();
  const players = db
    .prepare('SELECT id, bank_balance, has_bank_card FROM players WHERE bank_balance > 0')
    .all();
  const rate = balance.bankDailyInterestRate;
  const cardRate = balance.bankCardInterestRate;
  for (const p of players) {
    const r = p.has_bank_card ? cardRate : rate;
    const interest = Math.floor(p.bank_balance * r);
    if (interest > 0) {
      db.prepare('UPDATE players SET bank_balance = bank_balance + ? WHERE id = ?').run(
        interest,
        p.id
      );
    }
  }
}

function fluctuateCommodities() {
  const db = getDb();
  const rows = db.prepare('SELECT id, base_price, current_price FROM commodities').all();
  for (const c of rows) {
    const swing = 0.9 + Math.random() * 0.2;
    const next = Math.max(1, Math.floor(c.current_price * swing));
    const clamped = Math.max(Math.floor(c.base_price * 0.5), Math.min(Math.floor(c.base_price * 2), next));
    db.prepare('UPDATE commodities SET current_price = ? WHERE id = ?').run(clamped, c.id);
  }
}
