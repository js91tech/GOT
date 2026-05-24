import { GameService } from '@westeros/game-core';

const MAX = 25;

function matchQuery(text, q) {
  const t = String(text || '').toLowerCase();
  const needle = String(q || '').toLowerCase();
  return !needle || t.includes(needle);
}

function cap(choices) {
  return choices.slice(0, MAX);
}

function filterChoices(items, q, labelFn, valueFn) {
  return cap(
    items
      .filter((item) => matchQuery(labelFn(item), q) || matchQuery(valueFn(item), q))
      .map((item) => ({ name: labelFn(item).slice(0, 100), value: String(valueFn(item)).slice(0, 100) }))
  );
}

function filterIntChoices(items, q, labelFn, valueFn) {
  return cap(
    items
      .filter((item) => matchQuery(labelFn(item), q) || matchQuery(String(valueFn(item)), q))
      .map((item) => ({ name: labelFn(item).slice(0, 100), value: valueFn(item) }))
  );
}

export async function handleAutocomplete(interaction) {
  const cmd = interaction.commandName;
  const focused = interaction.options.getFocused(true);
  const uid = interaction.user.id;
  const name = interaction.user.username;
  const q = focused.value ?? '';

  if (cmd === 'shop' && focused.name === 'item') {
    return filterChoices(
      GameService.shop(),
      q,
      (i) => `${i.name} — ${i.shop_price}c`,
      (i) => i.id
    );
  }

  if (cmd === 'armory' && focused.name === 'item') {
    const { weapons, armor } = GameService.shopArmoryForPlayer(uid, name);
    return filterChoices(
      [...weapons, ...armor],
      q,
      (i) => `${i.name} (Lv${i.min_level}) — ${i.shop_price}c${i.locked ? ' 🔒' : ''}`,
      (i) => i.id
    );
  }

  if (cmd === 'use' && focused.name === 'item') {
    const { inventory } = GameService.profile(uid, name);
    return filterChoices(
      inventory,
      q,
      (i) => `${i.name} x${i.quantity}`,
      (i) => i.item_id
    );
  }

  if (cmd === 'equip' && focused.name === 'item') {
    const { inventory } = GameService.profile(uid, name);
    const equippable = inventory.filter((i) => i.equip_slot || ['weapon', 'armor', 'gear'].includes(i.item_type));
    return filterChoices(
      equippable,
      q,
      (i) => `${i.name} x${i.quantity}${i.equip_slot ? ` (${i.equip_slot})` : ''}`,
      (i) => i.item_id
    );
  }

  if (cmd === 'education' && focused.name === 'enroll') {
    return filterChoices(
      GameService.educationList(),
      q,
      (c) => `${c.name} — Lv${c.min_level}`,
      (c) => c.id
    );
  }

  if (cmd === 'clan' && focused.name === 'id') {
    const action = interaction.options.getString('action');
    if (action && action !== 'join') return [];
    return filterChoices(
      GameService.clans(),
      q,
      (c) => c.name,
      (c) => c.id
    );
  }

  if (cmd === 'company' && focused.name === 'id') {
    const action = interaction.options.getString('action');
    if (action && action !== 'join') return [];
    return filterChoices(
      GameService.companies(),
      q,
      (c) => c.name,
      (c) => c.id
    );
  }

  if (cmd === 'commodity' && focused.name === 'id') {
    return filterChoices(
      GameService.commodities(),
      q,
      (c) => `${c.name} @ ${c.current_price}c`,
      (c) => c.id
    );
  }

  if (cmd === 'market' && focused.name === 'item') {
    const action = interaction.options.getString('action');
    if (action && action !== 'sell') return [];
    const { inventory } = GameService.profile(uid, name);
    return filterChoices(
      inventory,
      q,
      (i) => `${i.name} x${i.quantity}`,
      (i) => i.item_id
    );
  }

  if (cmd === 'market' && focused.name === 'listing') {
    const action = interaction.options.getString('action');
    if (action && action !== 'buy') return [];
    return filterIntChoices(
      GameService.marketBrowse(),
      q,
      (l) => `#${l.id} ${l.name || l.item_id} x${l.quantity} — ${l.price}c`,
      (l) => l.id
    );
  }

  if (cmd === 'gold' && focused.name === 'listing') {
    const action = interaction.options.getString('action');
    if (action && action !== 'buy') return [];
    return filterIntChoices(
      GameService.goldBrowse(),
      q,
      (l) => `#${l.id} ${l.gold_amount} relics — ${l.price}c`,
      (l) => l.id
    );
  }

  if (cmd === 'guild' && focused.name === 'id') {
    const action = interaction.options.getString('action');
    if (action && action !== 'join') return [];
    const guilds = GameService.guilds(50);
    return filterIntChoices(
      guilds,
      q,
      (g) => `[${g.tag}] ${g.name}`,
      (g) => g.id
    );
  }

  if (cmd === 'estate' && focused.name === 'buy') {
    return filterIntChoices(
      GameService.estates(),
      q,
      (e) => `Tier ${e.tier} — ${e.name} (${e.cost}c)`,
      (e) => e.tier
    );
  }

  if (cmd === 'class' && focused.name === 'choose') {
    const progress = GameService.classProgress(uid, name);
    const options = progress.milestone?.options || [];
    return filterChoices(
      options,
      q,
      (c) => `${c.icon} ${c.name} (Lv${c.minLevel})`,
      (c) => c.id
    );
  }

  if (cmd === 'crime' && focused.name === 'mission') {
    return filterChoices(
      GameService.crimes(uid, name),
      q,
      (c) => `${c.name} (Lv${c.min_level})${c.locked ? ' 🔒' : ''}`,
      (c) => c.id
    );
  }

  if (cmd === 'job' && focused.name === 'id') {
    return filterChoices(
      GameService.listJobs(),
      q,
      (j) => `${j.name} (Lv${j.min_level})`,
      (j) => j.id
    );
  }

  if (cmd === 'gym' && focused.name === 'id') {
    const action = interaction.options.getString('action');
    if (action && action !== 'set') return [];
    return filterChoices(
      GameService.gyms(),
      q,
      (g) => `${g.name} ×${g.train_multiplier} (Lv${g.min_level})`,
      (g) => g.id
    );
  }

  if (cmd === 'forge' && focused.name === 'recipe') {
    return filterChoices(
      GameService.recipes(),
      q,
      (r) => `${r.name} (${r.coin_cost}c)`,
      (r) => r.id
    );
  }

  if (cmd === 'dailyquest' && focused.name === 'id') {
    const action = interaction.options.getString('action');
    if (action && action !== 'claim') return [];
    const quests = GameService.dailyQuests(uid, name).filter((quest) => quest.done && !quest.claimed);
    return filterChoices(
      quests,
      q,
      (quest) => `${quest.label} (+${quest.coins}c)`,
      (quest) => quest.id
    );
  }

  return [];
}
