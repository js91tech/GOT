import { assetUrl } from './assets.js';

const COUNT = 6;

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable portrait per player (Discord id or username). */
export function portraitUrl(discordId, username) {
  const key = String(discordId || username || '0');
  const idx = hashString(key) % COUNT;
  return assetUrl(`/public/assets/portraits/portrait-${idx}.svg`);
}
