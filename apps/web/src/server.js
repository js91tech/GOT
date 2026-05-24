import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import { GameService } from '@westeros/game-core';
import { gifForAction, HERO_IMAGE, MISSION_IMAGE, crestUrl } from './action-media.js';
import { itemIconUrl } from './item-icons.js';
import { portraitUrl } from './portraits.js';
import { createApiProxy, resolveApiProxyTarget } from './api-proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(root, '.env') });

function dashRedirect(res, r, action) {
  const params = new URLSearchParams({
    msg: r.message || 'Done.',
    action: action || 'default',
    ok: r.ok !== false ? '1' : '0'
  });
  res.redirect(`/dashboard?${params.toString()}`);
}

process.env.DATABASE_PATH = process.env.DATABASE_PATH || path.join(root, 'data/westeros.db');

const app = express();
const port = Number(process.env.PORT || process.env.WEB_PORT) || 3847;

/** Public URL for OAuth — must match Discord Developer Portal redirect exactly. */
function normalizeHttpsUrl(raw) {
  const trimmed = (raw || '').trim().replace(/\/$/, '');
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getBaseUrl() {
  const fromEnv = normalizeHttpsUrl(process.env.WEB_BASE_URL);
  if (fromEnv) return fromEnv;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return normalizeHttpsUrl(process.env.RAILWAY_PUBLIC_DOMAIN);
  }
  if (process.env.RAILWAY_STATIC_URL) {
    return normalizeHttpsUrl(process.env.RAILWAY_STATIC_URL);
  }
  return `http://localhost:${port}`;
}

const baseUrl = getBaseUrl();
const oauthRedirectUri = `${baseUrl}/oauth/callback`;

/** Hosted Phaser client (westeros-game-2d). Unset on Railway = Activity-only (no browser link). */
function getGame2dUrl() {
  const raw = process.env.GAME_2D_URL;
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

function buildLaunch2dUrl(session) {
  const base = getGame2dUrl();
  if (!base) return null;
  const params = new URLSearchParams({
    discord_id: session.discordId,
    username: session.username || 'Lord'
  });
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}${params.toString()}`;
}

function getLaunch2dHint() {
  if (!getGame2dUrl()) {
    return 'Play in Discord: join a voice channel → Activities (rocket). Optional browser link: set GAME_2D_URL on the web service.';
  }
  return 'Primary: voice channel → Activities (rocket). Browser link below is optional.';
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
  })
);
app.use('/public', express.static(path.join(__dirname, 'public')));

const apiProxyTarget = resolveApiProxyTarget();
if (apiProxyTarget) {
  console.log(`Web: /api/* → ${apiProxyTarget} (Discord Activity can map /api to this same domain)`);
  app.use('/api', createApiProxy(apiProxyTarget));
}

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'web' });
});

const stopTicks = GameService.startScheduler();

function requireAuth(req, res, next) {
  if (!req.session.discordId) return res.redirect('/login');
  next();
}

app.get('/', (req, res) => {
  if (req.session.discordId) return res.redirect('/dashboard');
  res.render('home', { baseUrl });
});

app.get('/login', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return res.status(500).send('Set DISCORD_CLIENT_ID in Railway variables.');
  const redirect = encodeURIComponent(oauthRedirectUri);
  const scope = encodeURIComponent('identify');
  res.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}`
  );
});

app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/');
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: oauthRedirectUri
      })
    });
    const token = await tokenRes.json();
    if (!token.access_token) throw new Error('OAuth failed');
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    const user = await userRes.json();
    req.session.discordId = user.id;
    req.session.username = user.username;
    GameService.profile(user.id, user.username);
    res.redirect('/dashboard');
  } catch (e) {
    console.error(e);
    res.status(500).send('Login failed. Check OAuth redirect URL in Discord developer portal.');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/me', requireAuth, (req, res) => {
  const { player, status, inventory } = GameService.profile(req.session.discordId, req.session.username);
  res.json({ player, status, inventory });
});

app.get('/dashboard', requireAuth, (req, res) => {
  const id = req.session.discordId;
  const name = req.session.username;
  const { player, status, inventory } = GameService.profile(id, name);
  const confinement = GameService.confinement(id, name);
  const crimes = GameService.crimes(id, name);
  const action = req.query.action || '';
  const flashOk = req.query.ok !== '0';
  const factions = GameService.factions();
  const house = player.faction_id ? factions.find((f) => f.id === player.faction_id) : null;
  const inventoryWithIcons = inventory.map((i) => ({
    ...i,
    iconUrl: itemIconUrl(i.item_id, i.item_type)
  }));
  const equippable = inventoryWithIcons.filter(
    (i) => i.equip_slot || ['weapon', 'armor', 'gear'].includes(i.item_type)
  );
  const { sheet } = GameService.characterSheet(id, name);
  res.render('dashboard', {
    player,
    status,
    sheet,
    inventory: inventoryWithIcons,
    equippable,
    confinement,
    crimes,
    factions,
    house,
    houseCrest: house ? crestUrl(house.crest_key) : null,
    flash: req.query.msg,
    flashAction: action,
    flashGif: gifForAction(action, flashOk),
    flashOk,
    heroImage: HERO_IMAGE,
    missionImage: MISSION_IMAGE,
    game2dUrl: getGame2dUrl(),
    launch2dUrl: buildLaunch2dUrl(req.session),
    launch2dHint: getLaunch2dHint()
  });
});

/** Play hub — redirects to 2D launcher (Discord Activity or optional browser client). */
app.get('/play', requireAuth, (req, res) => {
  if (req.query.go === '1' && getGame2dUrl()) {
    const launch2dUrl = buildLaunch2dUrl(req.session);
    if (launch2dUrl) return res.redirect(launch2dUrl);
  }
  res.render('play-2d', {
    launch2dUrl: buildLaunch2dUrl(req.session),
    game2dUrl: getGame2dUrl(),
    launch2dHint: getLaunch2dHint()
  });
});

/** Launch 2D client as the logged-in Discord user (query params + API dev auth). */
app.get('/play/2d', requireAuth, (req, res) => {
  const launch2dUrl = buildLaunch2dUrl(req.session);
  if (req.query.go === '1' && launch2dUrl) {
    return res.redirect(launch2dUrl);
  }
  res.render('play-2d', {
    launch2dUrl,
    game2dUrl: getGame2dUrl(),
    launch2dHint: getLaunch2dHint()
  });
});

app.post('/train', requireAuth, (req, res) => {
  const r = GameService.train(
    req.session.discordId,
    req.session.username,
    Number(req.body.sets) || 1,
    req.body.stat || 'strength'
  );
  dashRedirect(res, r, 'train');
});

app.post('/worker', requireAuth, (req, res) => {
  const r = GameService.trainWorker(
    req.session.discordId,
    req.session.username,
    req.body.stat,
    Number(req.body.sets) || 1
  );
  dashRedirect(res, r, 'train');
});

app.post('/crime', requireAuth, (req, res) => {
  const r = GameService.crime(req.session.discordId, req.session.username, req.body.mission);
  dashRedirect(res, r, 'crime');
});

app.post('/work', requireAuth, (req, res) => {
  const r = GameService.work(req.session.discordId, req.session.username);
  dashRedirect(res, r, 'work');
});

app.post('/wheel', requireAuth, (req, res) => {
  const r = GameService.wheel(req.session.discordId, req.session.username);
  dashRedirect(res, r, 'wheel');
});

app.post('/lounge', requireAuth, (req, res) => {
  const r = GameService.lounge(req.session.discordId, req.session.username, req.body.action);
  dashRedirect(res, r, 'lounge');
});

app.post('/escape', requireAuth, (req, res) => {
  const r = GameService.escape(
    req.session.discordId,
    req.session.username,
    req.body.place,
    req.body.method || 'pay'
  );
  dashRedirect(res, r, 'escape');
});

app.post('/bank', requireAuth, (req, res) => {
  let r;
  if (req.body.action === 'collect') r = GameService.collectInvestment(req.session.discordId, req.session.username);
  else r = GameService.bank(req.session.discordId, req.session.username, req.body.action, req.body.amount);
  res.redirect('/dashboard?msg=' + encodeURIComponent(r.message));
});

app.get('/shop', requireAuth, (req, res) => {
  const items = GameService.shop().map((item) => ({
    ...item,
    iconUrl: itemIconUrl(item.id, item.item_type)
  }));
  res.render('shop', { items, flash: req.query.msg });
});

function mapArmoryItems(items) {
  return items.map((item) => ({
    ...item,
    iconUrl: itemIconUrl(item.id, item.item_type)
  }));
}

app.get('/armory', requireAuth, (req, res) => {
  const { weapons, armor } = GameService.shopArmoryForPlayer(req.session.discordId, req.session.username);
  res.render('armory', {
    weapons: mapArmoryItems(weapons),
    armor: mapArmoryItems(armor),
    flash: req.query.msg
  });
});

app.post('/armory/buy', requireAuth, (req, res) => {
  const r = GameService.shopBuy(req.session.discordId, req.session.username, req.body.item, 1);
  res.redirect('/armory?msg=' + encodeURIComponent(r.message));
});

app.post('/armory/equip', requireAuth, (req, res) => {
  const r = GameService.shopBuyEquip(req.session.discordId, req.session.username, req.body.item);
  res.redirect('/character?msg=' + encodeURIComponent(r.message));
});

app.get('/character', requireAuth, (req, res) => {
  const { player, sheet } = GameService.characterSheet(req.session.discordId, req.session.username);
  res.render('character', { player, sheet, flash: req.query.msg });
});

app.post('/unequip', requireAuth, (req, res) => {
  const r = GameService.unequip(req.session.discordId, req.session.username, req.body.slot);
  res.redirect('/character?msg=' + encodeURIComponent(r.message));
});

app.post('/shop/buy', requireAuth, (req, res) => {
  const r = GameService.shopBuy(req.session.discordId, req.session.username, req.body.item, req.body.quantity);
  res.redirect('/shop?msg=' + encodeURIComponent(r.message));
});

app.get('/pvp', requireAuth, (req, res) => {
  const players = GameService.listPlayers(30)
    .filter((p) => p.discord_id !== req.session.discordId)
    .map((p) => ({
      ...p,
      portraitUrl: portraitUrl(p.discord_id, p.username)
    }));
  const flashOk = req.query.ok !== '0';
  res.render('pvp', {
    players,
    flash: req.query.msg,
    flashGif: gifForAction(req.query.action || 'attack', flashOk),
    flashOk
  });
});

app.post('/pvp', requireAuth, (req, res) => {
  const { action, target } = req.body;
  let r;
  if (action === 'attack') r = GameService.attack(req.session.discordId, req.session.username, target);
  else if (action === 'mug') r = GameService.mug(req.session.discordId, req.session.username, target);
  else r = GameService.rob(req.session.discordId, req.session.username, target);
  const params = new URLSearchParams({
    msg: r.message,
    action: action || 'attack',
    ok: r.ok !== false ? '1' : '0'
  });
  res.redirect(`/pvp?${params.toString()}`);
});

app.post('/bust', requireAuth, (req, res) => {
  const r = GameService.bust(req.session.discordId, req.session.username, req.body.target);
  res.redirect('/pvp?msg=' + encodeURIComponent(r.message));
});

app.get('/advanced', requireAuth, (req, res) => {
  res.render('advanced', {
    clans: GameService.clans(),
    estates: GameService.estates(),
    education: GameService.educationList(),
    commodities: GameService.commodities(),
    market: GameService.marketBrowse(),
    gold: GameService.goldBrowse(),
    flash: req.query.msg
  });
});

app.post('/advanced', requireAuth, (req, res) => {
  const { type } = req.body;
  let r = { message: 'Unknown' };
  const id = req.session.discordId;
  const name = req.session.username;
  if (type === 'joinClan') r = GameService.joinClan(id, name, req.body.clanId);
  if (type === 'buyEstate') r = GameService.buyEstate(id, name, Number(req.body.tier));
  if (type === 'enroll') r = GameService.educationEnroll(id, name, req.body.courseId);
  if (type === 'joinCompany') r = GameService.joinCompany(id, name, req.body.companyId);
  if (type === 'forge') r = GameService.forge(id, name, req.body.recipeId || 'valyrian_steel');
  if (type === 'delve') r = GameService.delve(id, name);
  if (type === 'endDelve') r = GameService.endDelve(id, name);
  if (type === 'grabbag') r = GameService.openGrabBag(id, name);
  if (type === 'commodity') r = GameService.commodityTrade(id, name, req.body.commId, Number(req.body.qty), req.body.action);
  res.redirect('/advanced?msg=' + encodeURIComponent(r.message));
});

app.post('/gym', requireAuth, (req, res) => {
  const r = GameService.setGym(req.session.discordId, req.session.username, req.body.gymId);
  dashRedirect(res, r, 'train');
});

app.post('/equip', requireAuth, (req, res) => {
  const r = GameService.equip(req.session.discordId, req.session.username, req.body.item);
  dashRedirect(res, r, 'default');
});

app.post('/drug', requireAuth, (req, res) => {
  const r = GameService.useDrug(req.session.discordId, req.session.username, req.body.drugId);
  dashRedirect(res, r, 'lounge');
});

app.get('/explore', requireAuth, (req, res) => {
  const r = GameService.explore(req.session.discordId, req.session.username);
  res.render('explore', {
    exploreText: r.message,
    flash: req.query.msg,
    pendingEncounter: r.pendingEncounter || null
  });
});

app.post('/explore', requireAuth, (req, res) => {
  const id = req.session.discordId;
  const name = req.session.username;
  let r;
  if (req.body.action === 'attack') r = GameService.pveAttack(id, name);
  else if (req.body.action === 'flee') r = GameService.pveFlee(id, name);
  else if (req.body.action === 'move') r = GameService.exploreMove(id, name, req.body.direction);
  else if (req.body.action === 'travel') r = GameService.exploreTravel(id, name, req.body.area);
  else if (req.body.action === 'mine') r = GameService.exploreMine(id, name);
  else if (req.body.action === 'hunt') r = GameService.exploreHunt(id, name);
  else if (req.body.action === 'talk') r = GameService.talkNpc(id, name, req.body.npc);
  else r = GameService.explore(id, name);
  res.redirect('/explore?msg=' + encodeURIComponent(r.message));
});

app.get('/leaderboard', (req, res) => {
  res.render('leaderboard', {
    rows: GameService.leaderboard(req.query.type || 'level'),
    type: req.query.type || 'level'
  });
});

app.get('/map', requireAuth, (req, res) => {
  const id = req.session.discordId;
  const name = req.session.username;
  const bootstrap = GameService.mapBootstrap(id, name);
  const msg = req.query.msg || '';
  res.render('map', {
    baseUrl,
    territories: bootstrap.territories,
    factions: bootstrap.factions,
    player: bootstrap.player,
    guild: bootstrap.guild,
    msg
  });
});

app.post('/map/siege', requireAuth, (req, res) => {
  const r = GameService.declareWar(req.session.discordId, req.session.username, req.body.territory_id);
  res.redirect('/map?msg=' + encodeURIComponent(r.message || 'Done.'));
});

app.post('/map/reinforce', requireAuth, (req, res) => {
  const r = GameService.contributeSiege(req.session.discordId, req.session.username);
  res.redirect('/map?msg=' + encodeURIComponent(r.message || 'Done.'));
});

app.post('/map/join-house', requireAuth, (req, res) => {
  const r = GameService.joinHouse(req.session.discordId, req.session.username, req.body.faction_id);
  res.redirect('/map?msg=' + encodeURIComponent(r.message || 'Done.'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Westeros web UI listening on 0.0.0.0:${port}`);
  console.log(`OAuth redirect URI (add this in Discord portal): ${oauthRedirectUri}`);
});

process.on('SIGINT', () => {
  stopTicks();
  process.exit(0);
});
