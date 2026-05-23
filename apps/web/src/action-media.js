/** GIF / image URLs for web action feedback (JJK-themed, CDN-hosted). */
export const ACTION_GIFS = {
  train: 'https://media.tenor.com/GoGoJSe8TEAAAAAC/yuji-itadori.gif',
  crime_ok: 'https://media.tenor.com/ko7bWDfCShAAAAAC/jujutsu-kaisen.gif',
  crime_fail: 'https://media.tenor.com/9q8SrxpE2BAAAAAC/jujutsu-kaisen-sukuna.gif',
  work: 'https://media.tenor.com/YnRN48GIAzcAAAAC/nanami.gif',
  attack: 'https://media.tenor.com/8OZU7GyFKGEAAAAC/gojo-satoru.gif',
  mug: 'https://media.tenor.com/9q8SrxpE2BAAAAAC/jujutsu-kaisen-sukuna.gif',
  rob: 'https://media.tenor.com/ko7bWDfCShAAAAAC/jujutsu-kaisen.gif',
  wheel: 'https://media.tenor.com/q4MxrjWZ868AAAAC/sukuna.gif',
  lounge: 'https://media.tenor.com/8OZU7GyFKGEAAAAC/gojo-satoru.gif',
  escape: 'https://media.tenor.com/shQoVhEw5hsAAAAC/shoko.gif',
  hospital: 'https://media.tenor.com/shQoVhEw5hsAAAAC/shoko.gif',
  jail: 'https://media.tenor.com/9q8SrxpE2BAAAAAC/jujutsu-kaisen-sukuna.gif',
  default: 'https://media.tenor.com/ko7bWDfCShAAAAAC/jujutsu-kaisen.gif'
};

export const HERO_IMAGE =
  'https://images.unsplash.com/photo-1612036781340-11596b5134a0?w=1200&q=80&auto=format&fit=crop';

export function gifForAction(action, success = true) {
  if (!action) return ACTION_GIFS.default;
  if (action === 'crime') return success ? ACTION_GIFS.crime_ok : ACTION_GIFS.crime_fail;
  return ACTION_GIFS[action] || ACTION_GIFS.default;
}
