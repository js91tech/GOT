/** Local SVG art for web action feedback and dashboard tiles. */
const A = '/public/assets/actions';

export const ACTION_IMAGES = {
  train: `${A}/train.svg`,
  crime_ok: `${A}/mission.svg`,
  crime_fail: `${A}/battle.svg`,
  work: `${A}/work.svg`,
  attack: `${A}/battle.svg`,
  mug: `${A}/battle.svg`,
  rob: `${A}/battle.svg`,
  wheel: `${A}/default.svg`,
  lounge: `${A}/feast.svg`,
  escape: `${A}/feast.svg`,
  hospital: `${A}/feast.svg`,
  jail: `${A}/battle.svg`,
  default: `${A}/default.svg`
};

export const HERO_IMAGE = '/public/assets/hero-realm.svg';
export const MISSION_IMAGE = `${A}/mission.svg`;

export function crestUrl(crestKey) {
  if (!crestKey) return null;
  return `/public/assets/crests/${crestKey}.svg`;
}

export function gifForAction(action, success = true) {
  if (!action) return ACTION_IMAGES.default;
  if (action === 'crime') return success ? ACTION_IMAGES.crime_ok : ACTION_IMAGES.crime_fail;
  return ACTION_IMAGES[action] || ACTION_IMAGES.default;
}
