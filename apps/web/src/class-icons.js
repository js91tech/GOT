import { assetUrl } from './assets.js';

const BASE = '/public/assets/classes';

/** Maps every class id to a heraldic badge SVG. */
const BY_CLASS = {
  squire: `${BASE}/squire.svg`,
  knight: `${BASE}/knight.svg`,
  maester: `${BASE}/maester.svg`,
  ranger: `${BASE}/ranger.svg`,
  kingsguard: `${BASE}/knight.svg`,
  champion: `${BASE}/knight.svg`,
  archmaester: `${BASE}/maester.svg`,
  septon: `${BASE}/septon.svg`,
  scout: `${BASE}/ranger.svg`,
  cutpurse: `${BASE}/cutpurse.svg`,
  lord_commander: `${BASE}/knight.svg`,
  knight_errant: `${BASE}/knight.svg`,
  grand_maester: `${BASE}/maester.svg`,
  high_septon: `${BASE}/septon.svg`,
  warden: `${BASE}/ranger.svg`,
  master_of_whispers: `${BASE}/cutpurse.svg`
};

export function classIconUrl(classId) {
  const path = BY_CLASS[classId] || BY_CLASS.squire;
  return assetUrl(path);
}
