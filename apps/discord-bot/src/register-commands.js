import 'dotenv/config';
import { registerSlashCommands } from './register-slash.js';

try {
  await registerSlashCommands();
} catch (err) {
  console.error('Command registration failed:', err);
  process.exit(1);
}
