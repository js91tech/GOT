import { assetUrl } from './assets.js';

/** Local SVG art for web action feedback and dashboard tiles. */
const A = '/public/assets/actions';

export const ACTION_IMAGES = {
  train: assetUrl(`${A}/train.svg`),
  crime_ok: assetUrl(`${A}/mission.svg`),
  crime_fail: assetUrl(`${A}/battle.svg`),
  work: assetUrl(`${A}/work.svg`),
  attack: assetUrl(`${A}/battle.svg`),
  mug: assetUrl(`${A}/battle.svg`),
  rob: assetUrl(`${A}/battle.svg`),
  wheel: assetUrl(`${A}/default.svg`),
  lounge: assetUrl(`${A}/feast.svg`),
  escape: assetUrl(`${A}/feast.svg`),
  hospital: assetUrl(`${A}/feast.svg`),
  jail: assetUrl(`${A}/battle.svg`),
  default: assetUrl(`${A}/default.svg`)
};

export const HERO_IMAGE = assetUrl('/public/assets/hero-realm.svg');
export const MISSION_IMAGE = assetUrl(`${A}/mission.svg`);
export const MISSION_IMAGES = {
  petty_raid: assetUrl(`${A}/mission_raid.svg`),
  border_patrol: assetUrl(`${A}/mission_patrol.svg`),
  sack_village: assetUrl(`${A}/mission_sack.svg`),
  siege_assault: assetUrl(`${A}/mission_siege.svg`)
};

export function missionImageUrl(missionId) {
  return MISSION_IMAGES[missionId] || MISSION_IMAGE;
}
export const TRAIN_IMAGE = assetUrl(`${A}/train.svg`);
export const WORK_IMAGE = assetUrl(`${A}/work.svg`);
export const WHEEL_IMAGE = assetUrl('/public/assets/icons/wheel.svg');

export function crestUrl(crestKey) {
  if (!crestKey) return null;
  return assetUrl(`/public/assets/crests/${crestKey}.svg`);
}

export function gifForAction(action, success = true) {
  if (!action) return ACTION_IMAGES.default;
  if (action === 'crime') return success ? ACTION_IMAGES.crime_ok : ACTION_IMAGES.crime_fail;
  return ACTION_IMAGES[action] || ACTION_IMAGES.default;
}
