import crypto from 'crypto';

const PREFIX = 'jjk.';

function sessionSecret() {
  return (
    process.env.ACTIVITY_SESSION_SECRET ||
    process.env.DISCORD_CLIENT_SECRET ||
    process.env.SESSION_SECRET ||
    'change-me-activity-session'
  );
}

/** Short-lived signed token for Discord Activity (proxy-safe; avoids re-hitting Discord @me every request). */
export function signActivitySession(discordId, username) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ id: String(discordId), u: String(username), exp }), 'utf8').toString(
    'base64url'
  );
  const sig = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${PREFIX}${payload}.${sig}`;
}

export function verifyActivitySession(token) {
  if (!token || !token.startsWith(PREFIX)) return null;
  const rest = token.slice(PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  if (sig.length !== expected.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.id || !data.exp || Date.now() > data.exp) return null;
    return { id: data.id, username: data.u || 'Sorcerer' };
  } catch {
    return null;
  }
}
