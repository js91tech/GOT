/**
 * Copies realm-world.png to discord-bot assets for /realm all attachment.
 * The painted map is the source asset; no SVG rendering needed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'apps/web/src/public/map/realm-world.png');
const outPaths = [
  path.join(root, 'apps/discord-bot/assets/realm-map.png')
];

if (!fs.existsSync(src)) {
  console.error('Missing realm-world.png at', src);
  process.exit(1);
}

for (const out of outPaths) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(src, out);
  console.log('Wrote', out);
}
