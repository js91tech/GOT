import { EmbedBuilder } from 'discord.js';

export function playerEmbed(player, title = 'Lord\'s Profile') {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x8b1a1a)
    .setDescription(
      `**${player.username}** — ${player.grade} (Lv.${player.level})\n` +
        `Gold: ${player.coins.toLocaleString()} | Vault: ${player.bank_balance.toLocaleString()}\n` +
        `Morale: ${player.ce}/100 | Focus: ${player.focus} | Resolve: ${player.resolve}\n` +
        `**Combat** — STR ${player.strength} | DEF ${player.defense} | SPD ${player.speed} | DEX ${player.dexterity}\n` +
        `**Household** — LAB ${player.manual_labor ?? 10} | INT ${player.intelligence ?? 10} | END ${player.endurance ?? 10} | TEC ${player.technique ?? 10}\n` +
        `HP: ${player.hp}/${player.max_hp} | Bravery: ${player.bravery} | Yard: ${player.gym_id || 'training_grounds'}\n` +
        `Grain: ${player.rice} | Dragon coins: ${player.gold_objects} | Realm: ${player.world_id}`
    );
}
