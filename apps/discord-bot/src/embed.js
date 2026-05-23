import { EmbedBuilder } from 'discord.js';

export function playerEmbed(player, title = 'Sorcerer Profile') {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(0x6a0dad)
    .setDescription(
      `**${player.username}** — ${player.grade} (Lv.${player.level})\n` +
        `Coins: ${player.coins.toLocaleString()} | Bank: ${player.bank_balance.toLocaleString()}\n` +
        `CE: ${player.ce}/100 | Focus: ${player.focus} | Resolve: ${player.resolve}\n` +
        `**Combat** — STR ${player.strength} | DEF ${player.defense} | SPD ${player.speed} | DEX ${player.dexterity}\n` +
        `**Worker** — LAB ${player.manual_labor ?? 10} | INT ${player.intelligence ?? 10} | END ${player.endurance ?? 10} | TEC ${player.technique ?? 10}\n` +
        `HP: ${player.hp}/${player.max_hp} | Bravery: ${player.bravery} | Gym: ${player.gym_id || 'training_grounds'}\n` +
        `Rice: ${player.rice} | Cursed Objects: ${player.gold_objects} | Region: ${player.world_id}`
    );
}
