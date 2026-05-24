/** Cache-busting version — bump when static art changes. */
export const ASSET_VERSION = '8';

export function assetUrl(path) {
  if (!path) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}v=${ASSET_VERSION}`;
}
