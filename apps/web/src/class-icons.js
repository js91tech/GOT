import { assetUrl } from './assets.js';

const BASE = '/public/assets/classes';

const BY_CLASS = {
  squire: `${BASE}/squire.svg`,
  knight: `${BASE}/knight.svg`,
  maester: `${BASE}/maester.svg`,
  ranger: `${BASE}/ranger.svg`,
  kingsguard: `${BASE}/kingsguard.svg`,
  champion: `${BASE}/champion.svg`,
  archmaester: `${BASE}/archmaester.svg`,
  septon: `${BASE}/septon.svg`,
  scout: `${BASE}/scout.svg`,
  cutpurse: `${BASE}/cutpurse.svg`,
  lord_commander: `${BASE}/lord_commander.svg`,
  knight_errant: `${BASE}/knight_errant.svg`,
  grand_maester: `${BASE}/grand_maester.svg`,
  high_septon: `${BASE}/high_septon.svg`,
  warden: `${BASE}/warden.svg`,
  master_of_whispers: `${BASE}/master_of_whispers.svg`
};

export function classIconUrl(classId) {
  const path = BY_CLASS[classId] || BY_CLASS.squire;
  return assetUrl(path);
}
