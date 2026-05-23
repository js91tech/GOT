import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const bot = spawn('npm', ['start', '-w', '@westeros/discord-bot'], {
  cwd: root,
  stdio: 'inherit',
  shell: true
});

const web = spawn('npm', ['start', '-w', '@westeros/web'], {
  cwd: root,
  stdio: 'inherit',
  shell: true
});

process.on('SIGINT', () => {
  bot.kill();
  web.kill();
  process.exit(0);
});
