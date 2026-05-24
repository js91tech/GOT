import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import discord from 'discord.js';
const { Client, GatewayIntentBits, Events, MessageFlags, Routes, InteractionResponseType } = discord;
import { GameService } from '@westeros/game-core';
import { handleCommand } from './commands.js';
import { handleAutocomplete } from './autocomplete.js';
import { handlePveButton } from './pve-buttons.js';
import { registerSlashCommands } from './register-slash.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(root, '.env') });
process.env.DATABASE_PATH =
  process.env.DATABASE_PATH || path.resolve(root, 'data/westeros.db');

if (!process.env.DISCORD_TOKEN) {
  const stack = (process.env.SERVICE || '').toLowerCase() === 'stack';
  if (stack) {
    console.warn('DISCORD_TOKEN missing — bot skipped; web + API still run (fill .env for slash commands).');
    process.exit(0);
  }
  console.error('FATAL: DISCORD_TOKEN is missing. Add it to .env or Railway variables.');
  process.exit(1);
}

console.log('Starting Westeros Discord bot...');
console.log('DATABASE_PATH=', process.env.DATABASE_PATH || '(default)');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let stopTicks = () => {};
const serviceMode = (process.env.SERVICE || '').toLowerCase();
if (serviceMode !== 'stack') {
  try {
    stopTicks = GameService.startScheduler();
  } catch (err) {
    console.error('Scheduler failed:', err.message);
  }
}

client.on('error', (err) => console.error('Discord client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));

function webActivityUrl() {
  const raw =
    process.env.WEB_BASE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');
  const base = String(raw).trim().replace(/\/$/, '');
  return base ? `${base}/activity` : 'https://YOUR-WEB-URL/activity';
}

function play2dFailureMessage(launchErr) {
  const code = launchErr?.code ?? launchErr?.rawError?.code;
  const activityUrl = webActivityUrl();

  if (code === 50234) {
    return (
      '**Embedded App is not enabled** on this Discord application (error 50234).\n\n' +
      'In the [Discord Developer Portal](https://discord.com/developers/applications) → your app:\n' +
      '1. **Activities** → turn on **Embedded App**\n' +
      '2. **URL Mappings** → root `/` → `' +
      activityUrl +
      '`\n' +
      '3. **OAuth2** redirects include `http://127.0.0.1/callback` and `https://127.0.0.1/callback`\n\n' +
      `Until Activities are configured, open the dashboard in a browser: ${activityUrl}\n` +
      'Or join a voice channel → **Activities** (rocket) after step 1–2.'
    );
  }

  if (code === 50035 || /activity|embedded|mapping/i.test(launchErr?.message || '')) {
    return (
      'Could not launch the Activity. Check Discord portal: **Activities ON**, URL mapping root → `' +
      activityUrl +
      '`. Join a voice channel and try **Activities** (rocket) or `/play2d` again.'
    );
  }

  return `Could not launch Activity: ${launchErr?.message || 'Unknown error'}\n\nDashboard: ${activityUrl}`;
}

async function launchPlay2dActivity(interaction) {
  if (typeof interaction.launchActivity === 'function') {
    await interaction.launchActivity();
    console.log('play2d: launchActivity OK');
    return;
  }
  await interaction.client.rest.post(Routes.interactionCallback(interaction.id, interaction.token), {
    body: { type: InteractionResponseType.LaunchActivity }
  });
  console.log('play2d: LaunchActivity via REST fallback');
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Westeros Bot logged in as ${c.user.tag} (discord.js ${discord.version})`);
  if (process.env.REGISTER_COMMANDS_ON_START !== 'false') {
    try {
      await registerSlashCommands();
    } catch (err) {
      console.error('Slash command registration failed:', err.message);
      if (!process.env.DISCORD_CLIENT_ID) {
        console.error('Add DISCORD_CLIENT_ID (Application ID from Discord Developer Portal) on this service.');
      }
      if (!process.env.DISCORD_GUILD_ID) {
        console.error('Optional: DISCORD_GUILD_ID = your server ID for instant /commands (right-click server → Copy Server ID).');
      }
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isAutocomplete()) {
    try {
      const choices = await handleAutocomplete(interaction);
      await interaction.respond(choices);
    } catch (err) {
      console.error('Autocomplete error:', err.message);
      await interaction.respond([]).catch(() => {});
    }
    return;
  }
  if (interaction.isButton()) {
    try {
      if (interaction.customId?.startsWith('pve:')) {
        await handlePveButton(interaction);
        return;
      }
    } catch (err) {
      console.error('Button error:', err.message);
      const msg = err.message || 'Something went wrong.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'play2d') {
      try {
        await launchPlay2dActivity(interaction);
      } catch (launchErr) {
        console.error('play2d failed:', launchErr?.raw ?? launchErr);
        const content = play2dFailureMessage(launchErr);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({ content, flags: MessageFlags.Ephemeral })
            .catch((e) => console.error('play2d reply failed:', e.message));
        }
      }
      return;
    }
    const result = await handleCommand(interaction);
    const flags = result.ephemeral ? MessageFlags.Ephemeral : undefined;
    if (result.embed) {
      await interaction.reply({ embeds: [result.embed], flags, files: result.files, components: result.components });
    } else {
      await interaction.reply({ content: result.content, flags, files: result.files, components: result.components });
    }
  } catch (err) {
    console.error('Command error:', interaction.commandName, err);
    const msg = err.message || 'Something went wrong.';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('Discord login failed — check DISCORD_TOKEN is valid and not truncated.');
  console.error(err.message || err);
  const stack = (process.env.SERVICE || '').toLowerCase() === 'stack';
  if (stack) {
    console.warn('Stack continues without bot (web + API still available).');
    process.exit(0);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  stopTicks();
  client.destroy();
  process.exit(0);
});
