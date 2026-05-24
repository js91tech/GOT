/**
 * Resize and compress PvP portrait PNGs (display size 96px; keep 256px @ ~2x).
 * Usage: npm run compress:portraits
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'apps/web/src/public/assets/portraits');

const MAX = 256;

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function compressOne(file) {
  const input = path.join(dir, file);
  const before = fs.statSync(input).size;
  const tmp = path.join(dir, `.compress-${file}`);

  await sharp(input)
    .resize(MAX, MAX, { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 9, palette: true, quality: 82, effort: 10 })
    .toFile(tmp);

  fs.renameSync(tmp, input);
  const after = fs.statSync(input).size;
  return { file, before, after };
}

if (!fs.existsSync(dir)) {
  console.error('Portrait directory not found:', dir);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => /^portrait-\d+\.png$/i.test(f));
if (!files.length) {
  console.error('No portrait-*.png files in', dir);
  process.exit(1);
}

let totalBefore = 0;
let totalAfter = 0;

for (const file of files.sort()) {
  const r = await compressOne(file);
  totalBefore += r.before;
  totalAfter += r.after;
  const pct = ((1 - r.after / r.before) * 100).toFixed(0);
  console.log(`${r.file}: ${fmt(r.before)} → ${fmt(r.after)} (−${pct}%)`);
}

console.log(`Total: ${fmt(totalBefore)} → ${fmt(totalAfter)}`);
