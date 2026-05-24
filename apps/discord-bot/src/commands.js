import path from 'path';
import { fileURLToPath } from 'url';
import { AttachmentBuilder } from 'discord.js';
import { GameService } from '@westeros/game-core';
import { playerEmbed } from './embed.js';
import { pveEncounterComponents } from './pve-buttons.js';

/** Prefer GameService message; avoid bogus "Done." from `msg || ok ? 'Done.'` precedence. */
function formatResultMessage(result) {
  if (result.message?.trim()) return result.message.trim();
  if (result.ok === false) return 'That did not work.';
  return 'Action completed.';
}

function reply(result, interaction, extra = {}) {
  const text = formatResultMessage(result);
  const ephemeral = result.ok === false;
  const components = result.encounterPending ? pveEncounterComponents() : undefined;
  if (result.player) {
    return {
      embed: playerEmbed(result.player, text),
      ephemeral,
      components,
      ...extra
    };
  }
  return { content: text, ephemeral, components, ...extra };
}

export async function handleCommand(interaction) {
  const uid = interaction.user.id;
  const name = interaction.user.username;
  const cmd = interaction.commandName;

  if (cmd === 'profile') {
    const { player, status, inventory } = GameService.profile(uid, name);
    const inv = inventory.map((i) => `${i.name} x${i.quantity}`).join('\n') || 'Empty';
    const equipped = GameService.equipped(player.id)
      .map((e) => `${e.equip_slot}: ${e.name}`)
      .join('\n') || 'None';
    const embed = playerEmbed(player, 'Lord\'s Profile', status);
    embed.addFields(
      {
        name: 'Worker',
        value: `Labor ${player.manual_labor} | INT ${player.intelligence} | END ${player.endurance} | TEC ${player.technique}`
      },
      { name: 'Equipped', value: equipped },
      { name: 'Status', value: status.blocked.blocked ? `${status.blocked.reason} until ${status.blocked.until}` : 'Active' },
      { name: 'Inventory', value: inv.slice(0, 900) }
    );
    return { embed };
  }

  if (cmd === 'status') {
    const s = GameService.status(uid, name);
    return {
      content:
        `**${s.grade}** Lv.${s.level} (${s.xp_current}/${s.xp_needed || 'MAX'} XP) | Morale ${s.ce} | Wheel: ${s.wheel_spins_left}\n` +
        `STR ${s.strength} DEF ${s.defense} SPD ${s.speed} DEX ${s.dexterity} | HP ${s.hp}/${s.max_hp}\n` +
        `Worker: LAB ${s.manual_labor} INT ${s.intelligence} END ${s.endurance} TEC ${s.technique}\n` +
        `Job: ${s.job_name || 'Stable Hand'} | Yard: ${s.gym_name || s.gym_id}${s.company_name ? ` | Company: ${s.company_name}` : ''}\n` +
        (s.work_ready ? 'Work: ready\n' : `Work: ${s.work_minutes_left}m cooldown\n`) +
        (s.login_streak > 1 ? `Login streak: ${s.login_streak} days\n` : '') +
        (s.hospital_until ? `Maester's tent until: ${s.hospital_until} — /escape place:hospital\n` : '') +
        (s.jail_until ? `Black cells until: ${s.jail_until} — /escape place:jail or /bust\n` : '')
    };
  }

  if (cmd === 'train') {
    return reply(
      GameService.train(
        uid,
        name,
        interaction.options.getInteger('sets') || 1,
        interaction.options.getString('stat') || 'strength'
      ),
      interaction
    );
  }
  if (cmd === 'crime') {
    const mission = interaction.options.getString('mission');
    if (!mission) {
      const list = GameService.crimes(uid, name)
        .map((c) => (c.locked ? `🔒 \`${c.id}\` ${c.name} — Lv.${c.min_level}` : `✅ \`${c.id}\` ${c.name} — Lv.${c.min_level}`))
        .join('\n');
      return { content: `**Missions**\n${list}` };
    }
    return reply(GameService.crime(uid, name, mission), interaction);
  }
  if (cmd === 'escape') {
    const place = interaction.options.getString('place');
    const method = interaction.options.getString('method') || 'pay';
    return reply(GameService.escape(uid, name, place, method), interaction);
  }
  if (cmd === 'work') return reply(GameService.work(uid, name), interaction);
  if (cmd === 'job') return reply(GameService.setJob(uid, name, interaction.options.getString('id')), interaction);
  if (cmd === 'bank') {
    const action = interaction.options.getString('action');
    if (action === 'collect') return reply(GameService.collectInvestment(uid, name), interaction);
    return reply(
      GameService.bank(uid, name, action, interaction.options.getInteger('amount') || 0),
      interaction
    );
  }
  if (cmd === 'shop') {
    const action = interaction.options.getString('action');
    if (action === 'list') {
      const items = GameService.shop();
      const text = items.map((i) => `\`${i.id}\` ${i.name} — ${i.shop_price}c`).join('\n');
      return { content: text || 'Shop empty.' };
    }
    return reply(
      GameService.shopBuy(uid, name, interaction.options.getString('item'), interaction.options.getInteger('quantity') || 1),
      interaction
    );
  }
  if (cmd === 'armory') {
    const action = interaction.options.getString('action');
    if (action === 'list') {
      const { weapons, armor } = GameService.shopArmoryForPlayer(uid, name);
      const fmt = (i) => `\`${i.id}\` ${i.name} (Lv${i.min_level}) — ${i.shop_price}c · ${i.effectLabel}${i.locked ? ' 🔒' : ''}`;
      const lines = [
        '**Weapons**',
        ...(weapons.length ? weapons.map(fmt) : ['— none —']),
        '',
        '**Armor**',
        ...(armor.length ? armor.map(fmt) : ['— none —'])
      ];
      return { content: lines.join('\n') };
    }
    const item = interaction.options.getString('item');
    if (action === 'equip') return reply(GameService.shopBuyEquip(uid, name, item), interaction);
    return reply(GameService.shopBuy(uid, name, item, 1), interaction);
  }
  if (cmd === 'character') {
    const { sheet } = GameService.characterSheet(uid, name);
    const c = sheet.combat;
    const w = sheet.worker;
    const lines = [
      `${sheet.class.current.icon} **${sheet.class.current.name}** · Combat power ${sheet.power} · HP ${sheet.hp}/${sheet.max_hp}`,
      `STR ${c.effective.strength} · DEF ${c.effective.defense} · SPD ${c.effective.speed} · DEX ${c.effective.dexterity}`,
      `Worker — LAB ${w.effective.manual_labor} · INT ${w.effective.intelligence} · END ${w.effective.endurance} · TEC ${w.effective.technique}`,
      '',
      sheet.class.bonusSummary,
      `Mission fail −${sheet.modifiers.missionFailReduction}% · coins +${sheet.modifiers.missionCoinBonus}% · mug +${sheet.modifiers.mugBonus}%`
    ];
    if (sheet.class.milestone?.due) {
      lines.push('', '_Class choice available — use `/class choose:<name>`_');
    }
    if (sheet.equipped.length) {
      lines.push('', '**Equipped**', ...sheet.equipped.map((e) => `${e.slot}: ${e.name} (${e.effects})`));
    } else {
      lines.push('', '_No gear equipped — `/armory list`_');
    }
    return { content: lines.join('\n') };
  }
  if (cmd === 'class') {
    const pick = interaction.options.getString('choose');
    if (pick) return reply(GameService.chooseClass(uid, name, pick), interaction);
    const progress = GameService.classProgress(uid, name);
    const lines = [
      `**${progress.current.icon} ${progress.current.name}** — ${progress.current.description}`,
      `Path: ${progress.path.map((c) => `${c.icon} ${c.name}`).join(' → ')}`,
      progress.bonusSummary
    ];
    if (progress.milestone?.due) {
      lines.push(
        '',
        `**Choose at Lv.${progress.milestone.nextLevel}+:**`,
        ...progress.milestone.options.map(
          (o) => `\`${o.id}\` ${o.icon} **${o.name}** — ${o.description}\n_${o.effectSummary}_`
        )
      );
      lines.push('', '_Use `/class choose:<id>`_');
    } else if (progress.atMaxClass) {
      lines.push('', '_You have mastered your class path._');
    } else if (progress.nextSpecializationLevel) {
      lines.push('', `Next oath at **Lv.${progress.nextSpecializationLevel}**`);
    }
    return { content: lines.join('\n') };
  }
  if (cmd === 'wheel') return reply(GameService.wheel(uid, name), interaction);
  if (cmd === 'lounge') return reply(GameService.lounge(uid, name, interaction.options.getString('action')), interaction);
  if (cmd === 'inventory') {
    const { inventory } = GameService.profile(uid, name);
    return { content: inventory.map((i) => `${i.item_id}: ${i.name} x${i.quantity}`).join('\n') || 'Empty.' };
  }
  if (cmd === 'use') return reply(GameService.useItem(uid, name, interaction.options.getString('item')), interaction);

  const target = interaction.options.getUser('target');
  if (cmd === 'attack') return reply(GameService.attack(uid, name, target.id), interaction);
  if (cmd === 'mug') return reply(GameService.mug(uid, name, target.id), interaction);
  if (cmd === 'rob') return reply(GameService.rob(uid, name, target.id), interaction);
  if (cmd === 'bust') return reply(GameService.bust(uid, name, target.id), interaction);

  if (cmd === 'education') {
    const enroll = interaction.options.getString('enroll');
    if (!enroll) {
      const courses = GameService.educationList();
      return { content: courses.map((c) => `\`${c.id}\` ${c.name} (Lv${c.min_level}) ${c.cost}c`).join('\n') };
    }
    return reply(GameService.educationEnroll(uid, name, enroll), interaction);
  }
  if (cmd === 'clan') {
    const action = interaction.options.getString('action') || 'list';
    if (action === 'list') {
      return { content: GameService.clans().map((c) => `\`${c.id}\` ${c.name}`).join('\n') };
    }
    if (action === 'join') return reply(GameService.joinClan(uid, name, interaction.options.getString('id')), interaction);
    if (action === 'deposit') {
      return reply(GameService.clanDeposit(uid, name, Number(interaction.options.getString('id'))), interaction);
    }
  }
  if (cmd === 'estate') {
    const tier = interaction.options.getInteger('buy');
    if (tier == null) {
      return { content: GameService.estates().map((e) => `T${e.tier} ${e.name} — ${e.cost}c (x${e.train_multiplier})`).join('\n') };
    }
    return reply(GameService.buyEstate(uid, name, tier), interaction);
  }
  if (cmd === 'market') {
    const action = interaction.options.getString('action') || 'browse';
    if (action === 'browse') {
      const rows = GameService.marketBrowse();
      return {
        content:
          rows.map((r) => `#${r.id} ${r.name} x${r.quantity} — ${r.price}c by ${r.username}`).join('\n') ||
          'No listings.'
      };
    }
    if (action === 'sell') {
      return reply(
        GameService.marketList(
          uid,
          name,
          interaction.options.getString('item'),
          interaction.options.getInteger('quantity'),
          interaction.options.getInteger('price')
        ),
        interaction
      );
    }
    return reply(GameService.marketBuy(uid, name, interaction.options.getInteger('listing')), interaction);
  }
  if (cmd === 'gold') {
    const action = interaction.options.getString('action') || 'browse';
    if (action === 'browse') {
      const rows = GameService.goldBrowse();
      return {
        content: rows.map((r) => `#${r.id} ${r.gold_amount} objects — ${r.price}c (${r.username})`).join('\n') || 'Empty.'
      };
    }
    if (action === 'sell') {
      return reply(
        GameService.goldList(uid, name, interaction.options.getInteger('amount'), interaction.options.getInteger('price')),
        interaction
      );
    }
    return reply(GameService.goldBuy(uid, name, interaction.options.getInteger('listing')), interaction);
  }
  if (cmd === 'forge') {
    const recipe = interaction.options.getString('recipe');
    if (!recipe) {
      const list = GameService.recipes()
        .map((r) => `\`${r.id}\` ${r.name} → ${r.output_item}`)
        .join('\n');
      return { content: list || 'No recipes.' };
    }
    return reply(GameService.forge(uid, name, recipe), interaction);
  }
  if (cmd === 'gym') {
    const action = interaction.options.getString('action') || 'list';
    if (action === 'set') {
      return reply(GameService.setGym(uid, name, interaction.options.getString('id') || 'training_grounds'), interaction);
    }
    return {
      content: GameService.gyms()
        .map((g) => `\`${g.id}\` ${g.name} x${g.train_multiplier} (Lv${g.min_level}${g.unlock_cost ? `, ${g.unlock_cost}c` : ''})`)
        .join('\n')
    };
  }
  if (cmd === 'worker') {
    return reply(
      GameService.trainWorker(uid, name, interaction.options.getString('stat'), interaction.options.getInteger('sets') || 1),
      interaction
    );
  }
  if (cmd === 'equip') return reply(GameService.equip(uid, name, interaction.options.getString('item')), interaction);
  if (cmd === 'unequip') return reply(GameService.unequip(uid, name, interaction.options.getString('slot')), interaction);
  if (cmd === 'company') {
    const action = interaction.options.getString('action') || 'list';
    if (action === 'join') return reply(GameService.joinCompany(uid, name, interaction.options.getString('id')), interaction);
    return {
      content: GameService.companies()
        .map((c) => `\`${c.id}\` ${c.name} (${c.worker_stat}, x${c.payout_mult})`)
        .join('\n')
    };
  }
  if (cmd === 'drug') {
    const action = interaction.options.getString('action') || 'list';
    if (action === 'use') return reply(GameService.useDrug(uid, name, interaction.options.getString('id')), interaction);
    return {
      content: GameService.drugs()
        .map((d) => `\`${d.id}\` ${d.name} — ${d.cost}c (${d.cooldown_minutes}m CD)`)
        .join('\n')
    };
  }
  if (cmd === 'explore') {
    const action = interaction.options.getString('action');
    if (action === 'look') return reply(GameService.explore(uid, name), interaction);
    if (action === 'move') return reply(GameService.exploreMove(uid, name, interaction.options.getString('direction') || 'north'), interaction);
    if (action === 'travel') return reply(GameService.exploreTravel(uid, name, interaction.options.getString('area') || 'winterfell'), interaction);
    if (action === 'mine') return reply(GameService.exploreMine(uid, name), interaction);
    if (action === 'hunt') return reply(GameService.exploreHunt(uid, name), interaction);
    if (action === 'attack') return reply(GameService.pveAttack(uid, name), interaction);
    if (action === 'flee') return reply(GameService.pveFlee(uid, name), interaction);
  }
  if (cmd === 'talk') return reply(GameService.talkNpc(uid, name, interaction.options.getString('npc')), interaction);
  if (cmd === 'commodity') {
    const action = interaction.options.getString('action') || 'list';
    if (action === 'list') {
      return { content: GameService.commodities().map((c) => `${c.id}: ${c.name} @ ${c.current_price}c`).join('\n') };
    }
    return reply(
      GameService.commodityTrade(uid, name, interaction.options.getString('id'), interaction.options.getInteger('quantity'), action),
      interaction
    );
  }
  if (cmd === 'delve') return reply(GameService.delve(uid, name), interaction);
  if (cmd === 'grabbag') {
    const action = interaction.options.getString('action') || 'open';
    if (action === 'buy') return reply(GameService.buyGrabBags(uid, name, interaction.options.getInteger('count') || 1), interaction);
    return reply(GameService.openGrabBag(uid, name), interaction);
  }
  if (cmd === 'leaderboard') {
    const rows = GameService.leaderboard(interaction.options.getString('type') || 'level');
    return {
      content: rows
        .map((r, i) => {
          if (r.wins != null) return `${i + 1}. ${r.username} — ${r.wins} wins`;
          const battle = (r.strength || 0) + (r.defense || 0) + (r.speed || 0) + (r.dexterity || 0);
          const statLine = r.strength != null ? ` [STR ${r.strength} DEF ${r.defense} SPD ${r.speed} DEX ${r.dexterity}]` : '';
          return `${i + 1}. ${r.username} — Lv${r.level}${statLine}${r.coins != null ? ` (${(r.coins + (r.bank_balance || 0)).toLocaleString()}c)` : ''} (battle ${battle})`;
        })
        .join('\n')
    };
  }
  if (cmd === 'house') {
    const action = interaction.options.getString('action') || 'list';
    if (action === 'list') {
      return {
        content: GameService.factions()
          .map((f) => `\`${f.id}\` **${f.name}** — _${f.motto}_`)
          .join('\n')
      };
    }
    if (action === 'join') {
      return reply(GameService.joinHouse(uid, name, interaction.options.getString('id')), interaction);
    }
  }
  if (cmd === 'guild') {
    const action = interaction.options.getString('action') || 'list';
    if (action === 'list') {
      const rows = GameService.guilds(15);
      return {
        content:
          rows
            .map((g) => `#${g.id} [${g.tag}] ${g.name} — ${g.member_count} members, ${g.treasury}c treasury`)
            .join('\n') || 'No guilds yet.'
      };
    }
    if (action === 'create') {
      return reply(
        GameService.createGuild(
          uid,
          name,
          interaction.options.getString('name'),
          interaction.options.getString('tag')
        ),
        interaction
      );
    }
    if (action === 'join') {
      return reply(
        GameService.joinGuild(uid, name, interaction.options.getInteger('id')),
        interaction
      );
    }
    if (action === 'leave') return reply(GameService.leaveGuild(uid, name), interaction);
    if (action === 'deposit') {
      return reply(
        GameService.guildDeposit(uid, name, interaction.options.getInteger('amount')),
        interaction
      );
    }
  }
  if (cmd === 'realm') {
    const region = interaction.options.getString('region');
    if (region === 'all') {
      const legend = GameService.realmMapLegend();
      const pngPath = GameService.realmMapPngPath();
      const baseUrl = process.env.WEB_BASE_URL || '';
      const link = baseUrl ? `\nInteractive map: ${baseUrl.replace(/\/$/, '')}/map` : '';
      const payload = {
        content: `**Realm lands & hourly resources**\n${legend}${link}`.slice(0, 2000)
      };
      if (pngPath) {
        payload.files = [new AttachmentBuilder(pngPath, { name: 'realm-map.png' })];
      }
      return payload;
    }
    if (region) {
      const detail = GameService.territory(region, uid, name);
      if (!detail.ok) return { content: detail.message, ephemeral: true };
      const t = detail.territory;
      return {
        content: `**${t.display_name}**\nResource: ${t.resource_type}\nOwner: ${t.owner_label}\nYield/hr: ${t.base_yield_per_hour}`
      };
    }
    const baseUrl = process.env.WEB_BASE_URL || '';
    const r = GameService.realm(baseUrl);
    const link = r.mapUrl ? `\nMap: ${r.mapUrl}` : '';
    return { content: `${r.message}${link}`.slice(0, 2000) };
  }
  if (cmd === 'war') {
    const action = interaction.options.getString('action') || 'status';
    if (action === 'declare') {
      return reply(
        GameService.declareWar(uid, name, interaction.options.getString('region')),
        interaction
      );
    }
    if (action === 'contribute') return reply(GameService.contributeSiege(uid, name), interaction);
    return reply(GameService.warStatus(uid, name), interaction);
  }
  if (cmd === 'world') return reply(GameService.setWorld(uid, name, interaction.options.getString('id')), interaction);
  if (cmd === 'admin') {
    const target = interaction.options.getUser('target');
    return reply(
      GameService.admin(uid, interaction.options.getString('action'), target.id, interaction.options.getInteger('value')),
      interaction
    );
  }

  return { content: 'Unknown command.', ephemeral: true };
}
