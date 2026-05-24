import { assetUrl } from './assets.js';

const COUNT = 6;

const CLASS_PORTRAIT = {
  squire: 0,
  knight: 1,
  kingsguard: 1,
  champion: 1,
  lord_commander: 1,
  knight_errant: 1,
  maester: 2,
  archmaester: 2,
  grand_maester: 2,
  septon: 2,
  high_septon: 2,
  ranger: 3,
  scout: 3,
  warden: 3,
  cutpurse: 4,
  master_of_whispers: 4
};

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Portrait keyed to class when possible, else stable hash per player. */
export function portraitUrl(discordId, username, classId) {
  const key = String(discordId || username || '0');
  const idx =
    CLASS_PORTRAIT[classId] !== undefined ? CLASS_PORTRAIT[classId] : hashString(key) % COUNT;
  return assetUrl(`/public/assets/portraits/portrait-${idx}.svg`);
}
