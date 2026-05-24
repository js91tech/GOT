import { EmbedBuilder } from 'discord.js';
import { gotLabel } from '@westeros/game-core';

export function playerEmbed(player, title = "Lord's Profile", status = null) {
  const gymLabel = status?.gym_name || gotLabel(player.gym_id, player.gym_id || 'training_grounds');
  const xpLine =
    status && !status.at_cap
      ? `XP: ${status.xp_current}/${status.xp_needed} to Lv.${player.level + 1}`
      : status?.at_cap
        ? 'XP: max level'
        : '';
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x8b1a1a)
    .setDescription(
      `**${player.username}** — ${player.grade} (Lv.${player.level})${xpLine ? `\n${xpLine}` : ''}\n` +
        `Gold: ${player.coins.toLocaleString()} | Vault: ${player.bank_balance.toLocaleString()}\n` +
        `Morale: ${player.ce}/100 | Focus: ${player.focus} | Resolve: ${player.resolve}\n` +
        `**Combat** — STR ${player.strength} | DEF ${player.defense} | SPD ${player.speed} | DEX ${player.dexterity}\n` +
        `**Household** — LAB ${player.manual_labor ?? 10} | INT ${player.intelligence ?? 10} | END ${player.endurance ?? 10} | TEC ${player.technique ?? 10}\n` +
        `HP: ${player.hp}/${player.max_hp} | Bravery: ${player.bravery} | Yard: ${gymLabel}\n` +
        `Job: ${status?.job_name || 'Stable Hand'} | Grain: ${player.rice} | Realm: ${player.world_id}`
    );
}
