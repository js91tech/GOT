import { DiscordSDK } from 'https://esm.sh/@discord/embedded-app-sdk@1.9.0';

const statusEl = document.getElementById('activity-status');
const fallbackEl = document.getElementById('activity-fallback');
const loginBtn = document.getElementById('activity-login-btn');
const diagEl = document.getElementById('activity-diag');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function logDiag(msg) {
  console.log('[activity]', msg);
  if (diagEl) {
    const line = document.createElement('div');
    line.textContent = msg;
    diagEl.appendChild(line);
    diagEl.hidden = false;
  }
}

function showLoginButton(reason) {
  if (loginBtn) loginBtn.hidden = false;
  if (fallbackEl) fallbackEl.hidden = false;
  if (reason) logDiag(reason);
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function inDiscordFrame() {
  try {
    if (window.parent === window) return false;
  } catch {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  return Boolean(params.get('frame_id') || params.get('instance_id') || params.get('platform'));
}

async function exchangeCode(authUrl, code) {
  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ code })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || `Auth failed (${res.status})`);
  }
  const redirect = data.redirect || document.body.dataset.activityRedirect || '/dashboard';
  window.location.assign(redirect);
}

async function authorizeAndSignIn(discordSdk, clientId, authUrl, { prompt = 'none' } = {}) {
  logDiag(`authorize(prompt=${prompt})`);
  const { code } = await withTimeout(
    discordSdk.commands.authorize({
      client_id: clientId,
      response_type: 'code',
      state: '',
      prompt,
      scope: ['identify']
    }),
    15000,
    'authorize'
  );
  setStatus('Signing you in…');
  logDiag('exchange code');
  await exchangeCode(authUrl, code);
}

async function bootstrap() {
  const clientId = document.body.dataset.discordClientId;
  const authUrl = document.body.dataset.activityAuthUrl || '/activity/auth';
  logDiag(`clientId=${clientId ? 'set' : 'MISSING'} frame=${inDiscordFrame()}`);

  if (!clientId) {
    setStatus('Activity is not configured (DISCORD_CLIENT_ID missing).');
    showLoginButton('Set DISCORD_CLIENT_ID on the web service.');
    return;
  }

  if (!inDiscordFrame()) {
    setStatus('Open this page inside a Discord Activity.');
    showLoginButton('Page is not inside a Discord iframe.');
    return;
  }

  let discordSdk;
  try {
    discordSdk = new DiscordSDK(clientId);
  } catch (err) {
    console.error('[activity-boot] SDK construct failed', err);
    setStatus('Discord SDK could not start.');
    showLoginButton(`SDK error: ${err.message || err}`);
    return;
  }

  try {
    logDiag('sdk.ready() …');
    await withTimeout(discordSdk.ready(), 8000, 'sdk.ready');
    logDiag('sdk.ready ok');
  } catch (err) {
    console.error('[activity-boot] SDK ready failed', err);
    setStatus('Discord did not finish loading this Activity. Reopen from the voice channel.');
    showLoginButton(`ready: ${err.message || err}`);
    return;
  }

  const runSignIn = async (prompt) => {
    if (loginBtn) loginBtn.disabled = true;
    try {
      setStatus(prompt === 'consent' ? 'Opening Discord sign-in…' : 'Connecting to Discord…');
      await authorizeAndSignIn(discordSdk, clientId, authUrl, { prompt });
    } catch (err) {
      console.error('[activity-boot]', err);
      setStatus('Tap "Sign in with Discord" to continue.');
      showLoginButton(`auth: ${err.message || err}`);
    } finally {
      if (loginBtn) loginBtn.disabled = false;
    }
  };

  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      runSignIn('consent');
    });
  }

  await runSignIn('none');
}

bootstrap().catch((err) => {
  console.error('[activity-boot] fatal', err);
  setStatus('Activity could not start.');
  showLoginButton(`fatal: ${err?.message || err}`);
});
