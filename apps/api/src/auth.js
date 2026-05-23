import { verifyActivitySession } from './activitySession.js';

function bearerToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const alt = req.headers['x-jjk-session'];
  if (alt) return String(alt);
  if (req.body?.session_token) return String(req.body.session_token);
  return null;
}

/**
 * Discord Bearer token auth for 2D Activity + dev headers.
 * Activity sessions use signed `jjk.*` tokens from POST /v1/auth/code.
 */
export async function resolveDiscordUser(req) {
  if (process.env.ALLOW_DEV_AUTH === 'true') {
    const devId = req.headers['x-discord-id'];
    const devName = req.headers['x-discord-username'] || 'DevSorcerer';
    if (devId) return { id: String(devId), username: String(devName) };
  }

  const token = bearerToken(req);
  if (!token) return null;

  const sessionUser = verifyActivitySession(token);
  if (sessionUser) return sessionUser;

  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  return { id: user.id, username: user.username || 'Sorcerer' };
}
export function requireAuth(handler) {
  return async (req, res, next) => {
    try {
      const user = await resolveDiscordUser(req);
      if (!user) {
        const hasToken = Boolean(bearerToken(req));
        console.warn(
          `[auth] 401 ${req.method} ${req.path} token=${hasToken ? 'present' : 'missing'}`
        );
        return res.status(401).json({ ok: false, message: 'Unauthorized. Log in with Discord.' });
      }
      req.discordId = user.id;
      req.discordUsername = user.username;
      return handler(req, res, next);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, message: 'Auth error' });
    }
  };
}
