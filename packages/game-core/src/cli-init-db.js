import { getDb, closeDb } from './db.js';

getDb();
console.log('Database initialized at', process.env.DATABASE_PATH || '(default data/westeros.db)');
closeDb();
