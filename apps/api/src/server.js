import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { GameService } from '@westeros/game-core';
import { requireAuth, resolveDiscordUser } from './auth.js';
import { signActivitySession } from './activitySession.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(root, '.env') });
process.env.DATABASE_PATH = process.env.DATABASE_PATH || path.join(root, 'data/westeros.db');

const app = express();
const port = Number(process.env.PORT || process.env.API_PORT) || 3848;

const devOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const activityOrigins = (process.env.ACTIVITY_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (activityOrigins.length === 0 && process.env.ALLOW_DEV_AUTH === 'true') {
  activityOrigins.push(...devOrigins);
}

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (activityOrigins.includes(origin)) return true;
  // Discord Activity iframe / proxy (direct browser calls during dev or misconfig)
  if (/\.discordsays\.com$/i.test(origin)) return true;
  if (/discord\.com$/i.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin(origin, cb) {
      cb(null, isAllowedCorsOrigin(origin));
    },
    credentials: true
  })
);
app.use(express.json());

if ((process.env.SERVICE || '').toLowerCase() !== 'stack') {
  GameService.startScheduler();
}

function wrap(result) {
  return {
    ok: result.ok !== false,
    message: result.message,
    player: result.player || null
  };
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'westeros-api' }));

async function handleMe(req, res) {
  const { player, status, inventory } = GameService.profile(req.discordId, req.discordUsername);
  const confinement = GameService.confinement(req.discordId, req.discordUsername);
  const equipped = GameService.equipped(player.id);
  res.json({ ok: true, player, status, inventory, confinement, equipped });
}

async function handleCrimes(req, res) {
  res.json({ ok: true, crimes: GameService.crimes(req.discordId, req.discordUsername) });
}

/** Who am I (creates player if new). POST accepts { session_token } for Discord Activity proxy. */
app.get('/v1/me', requireAuth(handleMe));
app.post('/v1/me', requireAuth(handleMe));

app.get('/v1/crimes', requireAuth(handleCrimes));
app.post('/v1/crimes', requireAuth(handleCrimes));

app.post('/v1/train', requireAuth(async (req, res) => {
  const { stat = 'strength', sets = 1 } = req.body || {};
  res.json(wrap(GameService.train(req.discordId, req.discordUsername, Number(sets) || 1, stat)));
}));

app.post('/v1/crime', requireAuth(async (req, res) => {
  const { mission } = req.body || {};
  if (!mission) return res.status(400).json({ ok: false, message: 'mission required' });
  res.json(wrap(GameService.crime(req.discordId, req.discordUsername, mission)));
}));

app.post('/v1/work', requireAuth(async (req, res) => {
  res.json(wrap(GameService.work(req.discordId, req.discordUsername)));
}));

app.post('/v1/attack', requireAuth(async (req, res) => {
  const { targetDiscordId } = req.body || {};
  if (!targetDiscordId) return res.status(400).json({ ok: false, message: 'targetDiscordId required' });
  res.json(wrap(GameService.attack(req.discordId, req.discordUsername, targetDiscordId)));
}));

app.get('/v1/explore', requireAuth(async (req, res) => {
  const r = GameService.explore(req.discordId, req.discordUsername);
  res.json({ ok: r.ok !== false, message: r.message, player: r.player });
}));

app.post('/v1/explore/move', requireAuth(async (req, res) => {
  const { direction } = req.body || {};
  res.json(wrap(GameService.exploreMove(req.discordId, req.discordUsername, direction || 'north')));
}));

app.post('/v1/escape', requireAuth(async (req, res) => {
  const { place, method = 'pay' } = req.body || {};
  res.json(wrap(GameService.escape(req.discordId, req.discordUsername, place, method)));
}));

/** List players for PvP target picker (same channel activity — all non-banned). */
app.get('/v1/players', requireAuth(async (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const rows = GameService.listPlayers(limit).filter((p) => p.discord_id !== req.discordId);
  res.json({ ok: true, players: rows });
}));

/** Discord Activity: exchange authorize code for access token. */
async function exchangeActivityOAuthCode(code, clientId, clientSecret) {
  // Discord Activities (desktop): register http://127.0.0.1/callback in Developer Portal → OAuth2
  const redirectUris = [
    'http://127.0.0.1/callback',
    'https://127.0.0.1/callback',
    'http://127.0.0.1',
    'https://127.0.0.1'
  ];
  let last = null;
  for (const redirect_uri of redirectUris) {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri
    });
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const token = await tokenRes.json();
    if (token.access_token) return token;
    last = token;
  }
  return last;
}

app.post('/v1/auth/code', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ ok: false, message: 'code required' });
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ ok: false, message: 'DISCORD_CLIENT_ID/SECRET not set on API service' });
  }
  const token = await exchangeActivityOAuthCode(code, clientId, clientSecret);
  if (!token.access_token) {
    const hint =
      token.error === 'invalid_grant'
        ? 'Add http://127.0.0.1/callback to Discord OAuth2 redirects; verify DISCORD_CLIENT_SECRET on API service'
        : token.error || 'unknown';
    console.error('Activity OAuth exchange failed:', hint, token);
    return res.status(401).json({
      ok: false,
      message: `OAuth exchange failed: ${hint}`,
      detail: token
    });
  }
  const fakeReq = { headers: { authorization: `Bearer ${token.access_token}` } };
  const user = await resolveDiscordUser(fakeReq);
  if (!user) return res.status(401).json({ ok: false, message: 'Could not load Discord user' });
  const { player, status, inventory } = GameService.profile(user.id, user.username);
  const confinement = GameService.confinement(user.id, user.username);
  const crimes = GameService.crimes(user.id, user.username);
  const session_token = signActivitySession(user.id, user.username);
  res.json({
    ok: true,
    access_token: token.access_token,
    session_token,
    discordId: user.id,
    username: user.username,
    player,
    status,
    inventory,
    confinement,
    crimes
  });
});

app.get('/v1/territories', requireAuth(async (req, res) => {
  res.json({ ok: true, territories: GameService.territories() });
}));
app.post('/v1/territories', requireAuth(async (req, res) => {
  res.json({ ok: true, territories: GameService.territories() });
}));

app.get('/v1/territories/:id', requireAuth(async (req, res) => {
  const detail = GameService.territory(req.params.id, req.discordId, req.discordUsername);
  if (!detail.ok) return res.status(404).json({ ok: false, message: detail.message });
  res.json({ ok: true, ...detail });
}));
app.post('/v1/territories/:id', requireAuth(async (req, res) => {
  const detail = GameService.territory(req.params.id, req.discordId, req.discordUsername);
  if (!detail.ok) return res.status(404).json({ ok: false, message: detail.message });
  res.json({ ok: true, ...detail });
}));

app.get('/v1/guilds', requireAuth(async (req, res) => {
  const limit = Math.min(50, Number(req.query.limit) || 20);
  res.json({ ok: true, guilds: GameService.guilds(limit) });
}));

app.post('/v1/guilds', requireAuth(async (req, res) => {
  const { name, tag } = req.body || {};
  if (!name || !tag) return res.status(400).json({ ok: false, message: 'name and tag required' });
  res.json(wrap(GameService.createGuild(req.discordId, req.discordUsername, name, tag)));
}));

app.get('/v1/guilds/:id', requireAuth(async (req, res) => {
  const guildId = Number(req.params.id);
  const guilds = GameService.guilds(100);
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) return res.status(404).json({ ok: false, message: 'Guild not found.' });
  const members = GameService.guildMembers(guildId);
  const player = GameService.profile(req.discordId, req.discordUsername).player;
  res.json({
    ok: true,
    guild,
    members,
    my_guild_id: player.guild_id || null
  });
}));

app.post('/v1/guilds/:id/join', requireAuth(async (req, res) => {
  const guildId = Number(req.params.id);
  if (!guildId) return res.status(400).json({ ok: false, message: 'Invalid guild id' });
  res.json(wrap(GameService.joinGuild(req.discordId, req.discordUsername, guildId)));
}));

app.post('/v1/guilds/:id/deposit', requireAuth(async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!amount || amount < 1) return res.status(400).json({ ok: false, message: 'amount required' });
  const player = GameService.profile(req.discordId, req.discordUsername).player;
  if (player.guild_id !== Number(req.params.id)) {
    return res.status(403).json({ ok: false, message: 'You are not in this guild.' });
  }
  res.json(wrap(GameService.guildDeposit(req.discordId, req.discordUsername, amount)));
}));

app.post('/v1/guilds/leave', requireAuth(async (req, res) => {
  res.json(wrap(GameService.leaveGuild(req.discordId, req.discordUsername)));
}));

app.get('/v1/map/bootstrap', requireAuth(async (req, res) => {
  res.json(GameService.mapBootstrap(req.discordId, req.discordUsername));
}));
app.post('/v1/map/bootstrap', requireAuth(async (req, res) => {
  res.json(GameService.mapBootstrap(req.discordId, req.discordUsername));
}));

app.post('/v1/war/declare', requireAuth(async (req, res) => {
  const { territoryId, region } = req.body || {};
  const id = territoryId || region;
  if (!id) return res.status(400).json({ ok: false, message: 'territoryId required' });
  res.json(wrap(GameService.declareWar(req.discordId, req.discordUsername, id)));
}));

app.post('/v1/war/contribute', requireAuth(async (req, res) => {
  res.json(wrap(GameService.contributeSiege(req.discordId, req.discordUsername)));
}));

app.post('/v1/auth/token', async (req, res) => {
  const { access_token } = req.body || {};
  if (!access_token) return res.status(400).json({ ok: false, message: 'access_token required' });
  const fakeReq = { headers: { authorization: `Bearer ${access_token}` } };
  const user = await resolveDiscordUser(fakeReq);
  if (!user) return res.status(401).json({ ok: false, message: 'Invalid token' });
  GameService.profile(user.id, user.username);
  res.json({ ok: true, discordId: user.id, username: user.username, access_token });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Westeros Game API on 0.0.0.0:${port}`);
  console.log(`CORS origins: ${activityOrigins.length ? activityOrigins.join(', ') : '(none — set ACTIVITY_ORIGINS)'}`);
  console.log(`DATABASE_PATH=${process.env.DATABASE_PATH}`);
  if (!activityOrigins.length && process.env.ALLOW_DEV_AUTH !== 'true') {
    console.warn('ACTIVITY_ORIGINS is empty. Set it to your hosted westeros-game-2d HTTPS URL (see docs/RAILWAY-2D-ACTIVITY.md).');
  }
  if (process.env.ALLOW_DEV_AUTH === 'true') console.log('DEV AUTH: X-Discord-Id / X-Discord-Username headers enabled');
});
