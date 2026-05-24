import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function pveEncounterComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('pve:attack')
        .setLabel('Attack')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚔️'),
      new ButtonBuilder()
        .setCustomId('pve:flee')
        .setLabel('Flee')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏃')
    )
  ];
}

export async function handlePveButton(interaction) {
  const uid = interaction.user.id;
  const name = interaction.user.username;
  const { GameService } = await import('@westeros/game-core');
  const { playerEmbed } = await import('./embed.js');

  let result;
  if (interaction.customId === 'pve:attack') {
    result = GameService.pveAttack(uid, name);
  } else if (interaction.customId === 'pve:flee') {
    result = GameService.pveFlee(uid, name);
  } else {
    return null;
  }

  const text = result.message?.trim() || 'Done.';
  const components = result.encounterPending ? pveEncounterComponents() : [];
  const payload = {
    content: text,
    components,
    embeds: result.player ? [playerEmbed(result.player, text)] : [],
    flags: result.ok === false ? 64 : undefined
  };
  if (payload.embeds.length) payload.content = undefined;
  await interaction.update(payload);
  return true;
}
