import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const viewsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/src/views');
const wrong = 'mot' + 'ion';
const right = 'div';

function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.ejs')) {
      let s = fs.readFileSync(p, 'utf8');
      const fixed = s.replace(new RegExp(`<\/?${wrong}\\b`, 'g'), (tag) => tag.replace(wrong, right));
      if (fixed !== s) fs.writeFileSync(p, fixed);
    }
  }
}

walk(viewsDir);
