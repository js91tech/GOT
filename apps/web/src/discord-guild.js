/**
 * Fetch Discord guild member IDs for the configured server (stack shares DISCORD_TOKEN).
 * Requires bot token + DISCORD_GUILD_ID and Server Members Intent on the bot app.
 */
export async function fetchGuildMemberUsers() {
  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;
  const guildId = (process.env.DISCORD_GUILD_ID || '').trim();
  if (!token || !guildId) return null;

  const members = [];
  let after = '0';
  try {
    for (let page = 0; page < 10; page++) {
      const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bot ${token}` }
      });
      if (!res.ok) {
        console.warn(`[discord-guild] members ${res.status} — check Server Members Intent`);
        return members.length ? members : null;
      }
      const batch = await res.json();
      if (!Array.isArray(batch) || !batch.length) break;
      for (const m of batch) {
        if (m.user?.id) {
          members.push({
            id: m.user.id,
            username: m.nick || m.user.global_name || m.user.username || 'Lord'
          });
        }
      }
      after = batch[batch.length - 1].user.id;
      if (batch.length < 1000) break;
    }
    return members;
  } catch (err) {
    console.warn('[discord-guild] fetch failed:', err.message);
    return members.length ? members : null;
  }
}
