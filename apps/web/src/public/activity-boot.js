import { DiscordSDK } from 'https://esm.sh/@discord/embedded-app-sdk@1.9.0';

const statusEl = document.getElementById('activity-status');
const fallbackEl = document.getElementById('activity-fallback');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

async function bootstrap() {
  const clientId = document.body.dataset.discordClientId;
  const authUrl = document.body.dataset.activityAuthUrl || '/activity/auth';
  if (!clientId) {
    setStatus('Activity is not configured (DISCORD_CLIENT_ID missing).');
    if (fallbackEl) fallbackEl.hidden = false;
    return;
  }

  const inDiscordFrame = window.parent !== window;
  if (!inDiscordFrame) {
    setStatus('Sign in to play');
    if (fallbackEl) fallbackEl.hidden = false;
    return;
  }

  try {
    const discordSdk = new DiscordSDK(clientId);
    await discordSdk.ready();
    const { code } = await discordSdk.commands.authorize({
      client_id: clientId,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify']
    });

    setStatus('Signing you in…');
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
    window.location.href = data.redirect || '/dashboard';
  } catch (err) {
    console.error('[activity-boot]', err);
    setStatus(err.message || 'Could not sign in from Discord Activity.');
    if (fallbackEl) fallbackEl.hidden = false;
  }
}

bootstrap();
