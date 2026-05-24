import { EmbedBuilder } from 'discord.js';
import { gotLabel } from '@westeros/game-core';

export function playerEmbed(player, title = "Lord's Profile", status = null) {
  const gymLabel = status?.gym_name || gotLabel(player.gym_id, player.gym_id || 'training_grounds');
  const moraleCap = status?.morale_regen_cap ?? 100;
  const focusCap = status?.focus_regen_cap ?? 100;
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
        `Morale: ${player.ce}/${moraleCap} | Focus: ${player.focus}/${focusCap} | Resolve: ${player.resolve}\n` +
        `**Combat** — STR ${player.strength} | DEF ${player.defense} | SPD ${player.speed} | DEX ${player.dexterity}\n` +
        `**Household** — LAB ${player.manual_labor ?? 10} | INT ${player.intelligence ?? 10} | END ${player.endurance ?? 10} | TEC ${player.technique ?? 10}\n` +
        `HP: ${player.hp}/${player.max_hp} | Bravery: ${player.bravery} | Yard: ${gymLabel}\n` +
        `Job: ${status?.job_name || 'Stable Hand'} | Grain: ${player.rice} | Realm: ${player.world_id}`
    );
}

function formatDrugCooldowns(drugCooldowns) {
  if (!drugCooldowns || !Object.keys(drugCooldowns).length) return '';
  const parts = Object.entries(drugCooldowns).map(([id, mins]) => `${gotLabel(id, id)} ${mins}m`);
  return `Tonics: ${parts.join(', ')}\n`;
}

export function formatStatusContent(s) {
  const moraleCap = s.morale_regen_cap ?? 100;
  let lines =
    `**${s.grade}** Lv.${s.level} (${s.xp_current}/${s.xp_needed || 'MAX'} XP) | Morale ${s.ce}/${moraleCap} | Wheel: ${s.wheel_spins_left}\n` +
    `STR ${s.strength} DEF ${s.defense} SPD ${s.speed} DEX ${s.dexterity} | HP ${s.hp}/${s.max_hp}\n` +
    `Worker: LAB ${s.manual_labor} INT ${s.intelligence} END ${s.endurance} TEC ${s.technique}\n` +
    `Job: ${s.job_name || 'Stable Hand'} | Yard: ${s.gym_name || s.gym_id}${s.company_name ? ` | Company: ${s.company_name}` : ''}\n` +
    (s.work_ready ? 'Work: ready\n' : `Work: ${s.work_minutes_left}m cooldown\n`);
  if (s.morale_regen_in > 0 && s.ce < moraleCap) {
    lines += `Morale regen: +5 in ${s.morale_regen_in}m\n`;
  }
  if (s.investment_amount) {
    lines += s.investment_mature
      ? `Investment: ${s.investment_amount.toLocaleString()} ready to collect\n`
      : `Investment: ${s.investment_amount.toLocaleString()} matures in ${s.investment_minutes_left}m\n`;
  }
  lines += formatDrugCooldowns(s.drug_cooldowns);
  if (s.login_streak > 1) lines += `Login streak: ${s.login_streak} days\n`;
  if (s.hospital_until) lines += `Maester's tent until: ${s.hospital_until} — /escape place:hospital\n`;
  if (s.jail_until) lines += `Black cells until: ${s.jail_until} — /escape place:jail or /bust\n`;
  return lines.trimEnd();
}
