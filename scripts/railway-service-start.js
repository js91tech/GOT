/**
 * Railway: one repo, multiple deploy modes via SERVICE.
 * Railway cannot attach one volume to multiple services — use SERVICE=botweb or stack.
 */
import http from 'http';
import { spawn } from 'child_process';

/** Bot-only has no HTTP app; Railway healthcheckPath=/health needs a listener on PORT. */
function startBotHealthServer() {
  const port = Number(process.env.PORT) || 3847;
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'bot' }));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`bot: healthcheck on 0.0.0.0:${port}/health (Railway deploy probe)`);
  });
  return server;
}

function detectService() {
  const explicit = (process.env.SERVICE || '').toLowerCase();
  if (['web', 'bot', 'api', 'botweb', 'stack'].includes(explicit)) return explicit;

  const name = (process.env.RAILWAY_SERVICE_NAME || '').toLowerCase();
  if (name.includes('api')) return 'api';
  if (name.includes('web')) return 'web';
  if (name.includes('bot') || name.includes('discord')) return 'bot';

  return 'stack';
}

function runWorkspace(workspace, label) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'start', '-w', workspace], {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with code ${code}`));
    });
  });
}

function runMany(workspaces) {
  const children = workspaces.map(({ workspace, label, env }) => {
    console.log(`Starting ${label} (${workspace})…`);
    const child = spawn('npm', ['run', 'start', '-w', workspace], {
      stdio: 'inherit',
      shell: true,
      env: env || process.env
    });
    child.on('exit', (code) => {
      console.error(`${label} exited (${code ?? 1})`);
      process.exit(code ?? 1);
    });
    return child;
  });
  process.on('SIGINT', () => children.forEach((c) => c.kill('SIGINT')));
  process.on('SIGTERM', () => children.forEach((c) => c.kill('SIGTERM')));
}

const service = detectService();

console.log(
  `Railway start: ${service} (SERVICE=${process.env.SERVICE || '-'} RAILWAY_SERVICE_NAME=${process.env.RAILWAY_SERVICE_NAME || '-'})`
);

if (service === 'botweb') {
  console.log('botweb: Discord bot + web UI in one container (one volume / one westeros.db)');
  runMany([
    { workspace: '@westeros/discord-bot', label: 'bot' },
    { workspace: '@westeros/web', label: 'web' }
  ]);
} else if (service === 'stack') {
  console.log('stack: bot + web + API in one container (one volume; web uses PORT, API uses API_PORT)');
  console.log('stack: expose ONE public URL → dashboard + Discord URL mapping /api → same host');
  const apiPort = process.env.API_PORT || '3848';
  process.env.API_PORT = apiPort;
  runMany([
    { workspace: '@westeros/discord-bot', label: 'bot' },
    { workspace: '@westeros/web', label: 'web' },
    {
      workspace: '@westeros/api',
      label: 'api',
      env: { ...process.env, API_PORT: apiPort, PORT: apiPort }
    }
  ]);
} else {
  const workspace =
    service === 'web' ? '@westeros/web' : service === 'api' ? '@westeros/api' : '@westeros/discord-bot';
  if (service === 'bot') startBotHealthServer();
  runWorkspace(workspace, service).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
