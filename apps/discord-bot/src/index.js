import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import discord from 'discord.js';
const {
  Client,
  GatewayIntentBits,
  Events,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = discord;
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

function webBaseUrl() {
  const raw =
    process.env.WEB_BASE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '');
  return String(raw).trim().replace(/\/$/, '');
}

function buildPlayReply() {
  const base = webBaseUrl();
  const loginUrl = base ? `${base}/login` : null;
  const dashboardUrl = base ? `${base}/dashboard` : null;

  if (!loginUrl) {
    return {
      content:
        'Set **WEB_BASE_URL** on Railway (e.g. `https://westerosdiscord-bot-production.up.railway.app`) so /play2d can link to the dashboard.',
      ephemeral: true
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('Westeros Realm')
    .setDescription('Click below to open the realm dashboard. Sign in with Discord to claim your lord.')
    .setColor(0xc8a96a);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('Open Dashboard')
      .setURL(loginUrl),
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel('Direct link')
      .setURL(dashboardUrl)
  );

  return { embed, row, ephemeral: true };
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
    if (interaction.commandName === 'play2d' || interaction.commandName === 'play') {
      const r = buildPlayReply();
      const flags = r.ephemeral ? MessageFlags.Ephemeral : undefined;
      if (r.embed) {
        await interaction.reply({ embeds: [r.embed], components: r.row ? [r.row] : [], flags });
      } else {
        await interaction.reply({ content: r.content, flags });
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
