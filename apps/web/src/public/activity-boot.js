import { DiscordSDK } from 'https://esm.sh/@discord/embedded-app-sdk@1.9.0';

const statusEl = document.getElementById('activity-status');
const fallbackEl = document.getElementById('activity-fallback');
const loginBtn = document.getElementById('activity-login-btn');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function showLoginButton() {
  if (loginBtn) loginBtn.hidden = false;
  if (fallbackEl) fallbackEl.hidden = false;
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
  const redirect =
    data.redirect ||
    document.body.dataset.activityRedirect ||
    '/dashboard';
  window.location.assign(redirect);
}

async function authorizeAndSignIn(discordSdk, clientId, authUrl, { prompt = 'none' } = {}) {
  const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: 'code',
    state: '',
    prompt,
    scope: ['identify']
  });
  setStatus('Signing you in…');
  await exchangeCode(authUrl, code);
}

async function bootstrap() {
  const clientId = document.body.dataset.discordClientId;
  const authUrl = document.body.dataset.activityAuthUrl || '/activity/auth';
  if (!clientId) {
    setStatus('Activity is not configured (DISCORD_CLIENT_ID missing).');
    showLoginButton();
    return;
  }

  let discordSdk;
  try {
    discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();
  } catch (err) {
    console.error('[activity-boot] SDK not available', err);
    setStatus('Open from Discord (voice → Activities) or use the button below.');
    showLoginButton();
    return;
  }

  const runSignIn = async (prompt) => {
    if (loginBtn) loginBtn.disabled = true;
    try {
      setStatus(prompt === 'consent' ? 'Opening Discord sign-in…' : 'Connecting to Discord…');
      await authorizeAndSignIn(discordSdk, clientId, authUrl, { prompt });
    } catch (err) {
      console.error('[activity-boot]', err);
      setStatus(err.message || 'Could not sign in. Tap the button to try again.');
      showLoginButton();
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

bootstrap();
