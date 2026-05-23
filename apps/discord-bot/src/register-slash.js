import { REST, Routes } from 'discord.js';
import { buildSlashCommands } from './slash-commands.js';

const SNOWFLAKE = /^\d{17,20}$/;

function requireSnowflake(raw, envName) {
  const value = String(raw ?? '').trim();
  if (!SNOWFLAKE.test(value)) {
    throw new Error(
      `${envName} must be a numeric Discord ID (17–20 digits). ` +
        `Copy Application ID from Discord Developer Portal → General Information.`
    );
  }
  return value;
}

/**
 * Register slash commands with Discord API.
 * Set DISCORD_GUILD_ID for instant commands on one server (recommended for testing).
 */
export async function registerSlashCommands() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = requireSnowflake(process.env.DISCORD_CLIENT_ID, 'DISCORD_CLIENT_ID');
  const guildRaw = process.env.DISCORD_GUILD_ID;
  const guildId = guildRaw ? requireSnowflake(guildRaw, 'DISCORD_GUILD_ID') : null;

  if (!token) {
    throw new Error('DISCORD_TOKEN is required to register commands');
  }

  const commands = buildSlashCommands();
  const rest = new REST({ version: '10' }).setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Registered ${commands.length} guild commands on server ${guildId} (instant)`);
    return { count: commands.length, scope: 'guild', guildId };
  }

  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`Registered ${commands.length} global commands (may take up to 1 hour to appear)`);
  return { count: commands.length, scope: 'global' };
}
