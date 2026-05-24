import { SlashCommandBuilder } from 'discord.js';

export function buildSlashCommands() {
  return [
    new SlashCommandBuilder()
      .setName('play2d')
      .setDescription('Launch the 2D game (Discord Activity)'),
    new SlashCommandBuilder().setName('profile').setDescription('Your lord profile'),
    new SlashCommandBuilder().setName('status').setDescription('Morale, timers, blockers'),
    new SlashCommandBuilder()
      .setName('dailyquest')
      .setDescription('View and claim daily quests')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('List quests or claim a reward')
          .addChoices(
            { name: 'list', value: 'list' },
            { name: 'claim', value: 'claim' }
          )
      )
      .addStringOption((o) =>
        o.setName('id').setDescription('Quest id to claim (use list first)').setAutocomplete(true)
      ),
    new SlashCommandBuilder()
      .setName('train')
      .setDescription('Train combat stats at your yard')
      .addStringOption((o) =>
        o
          .setName('stat')
          .setDescription('Stat to train')
          .setRequired(true)
          .addChoices(
            { name: 'Strength', value: 'strength' },
            { name: 'Defense', value: 'defense' },
            { name: 'Speed', value: 'speed' },
            { name: 'Dexterity', value: 'dexterity' }
          )
      )
      .addIntegerOption((o) => o.setName('sets').setDescription('Sets 1-20').setMinValue(1).setMaxValue(20)),
    new SlashCommandBuilder()
      .setName('crime')
      .setDescription('Run a realm mission')
      .addStringOption((o) =>
        o
          .setName('mission')
          .setDescription('Mission type (omit to list all)')
          .setAutocomplete(true)
      ),
    new SlashCommandBuilder().setName('work').setDescription('Do your job for coins and XP'),
    new SlashCommandBuilder()
      .setName('job')
      .setDescription('Set your job')
      .addStringOption((o) =>
        o.setName('id').setDescription('Job to take').setRequired(true).setAutocomplete(true)
      ),
    new SlashCommandBuilder()
      .setName('bank')
      .setDescription('Keep Treasury')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Bank action')
          .setRequired(true)
          .addChoices(
            { name: 'deposit', value: 'deposit' },
            { name: 'withdraw', value: 'withdraw' },
            { name: 'buycard', value: 'buycard' },
            { name: 'invest', value: 'invest' },
            { name: 'collect', value: 'collect' }
          )
      )
      .addIntegerOption((o) => o.setName('amount').setDescription('Amount for deposit/withdraw/invest')),
    new SlashCommandBuilder()
      .setName('shop')
      .setDescription('Relic shop')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Shop action')
          .setRequired(true)
          .addChoices({ name: 'list', value: 'list' }, { name: 'buy', value: 'buy' })
      )
      .addStringOption((o) => o.setName('item').setDescription('Item to buy').setAutocomplete(true))
      .addIntegerOption((o) => o.setName('quantity').setDescription('Qty')),
    new SlashCommandBuilder()
      .setName('armory')
      .setDescription('Weapons & armor — buy and equip gear that boosts stats')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Armory action')
          .setRequired(true)
          .addChoices(
            { name: 'list', value: 'list' },
            { name: 'buy', value: 'buy' },
            { name: 'equip', value: 'equip' }
          )
      )
      .addStringOption((o) => o.setName('item').setDescription('Weapon or armor').setAutocomplete(true)),
    new SlashCommandBuilder().setName('wheel').setDescription('Mission roulette spin'),
    new SlashCommandBuilder()
      .setName('lounge')
      .setDescription('War camp — feast, oath, rally morale')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Lounge action')
          .setRequired(true)
          .addChoices(
            { name: 'tea', value: 'tea' },
            { name: 'vow', value: 'vow' },
            { name: 'refill', value: 'refill' }
          )
      ),
    new SlashCommandBuilder()
      .setName('attack')
      .setDescription('Duel another lord')
      .addUserOption((o) => o.setName('target').setDescription('Target lord').setRequired(true)),
    new SlashCommandBuilder()
      .setName('mug')
      .setDescription('Steal coins')
      .addUserOption((o) => o.setName('target').setDescription('Target lord').setRequired(true)),
    new SlashCommandBuilder()
      .setName('rob')
      .setDescription('Rob coins (larger haul)')
      .addUserOption((o) => o.setName('target').setDescription('Target lord').setRequired(true)),
    new SlashCommandBuilder()
      .setName('bust')
      .setDescription('Break ally out of the black cells')
      .addUserOption((o) => o.setName('target').setDescription('Ally to bust').setRequired(true)),
    new SlashCommandBuilder().setName('inventory').setDescription('Your items'),
    new SlashCommandBuilder()
      .setName('use')
      .setDescription('Use an item')
      .addStringOption((o) => o.setName('item').setDescription('Item from your inventory').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('education')
      .setDescription('Maester curriculum')
      .addStringOption((o) => o.setName('enroll').setDescription('Course to enroll in').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('clan')
      .setDescription('Great House squad')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Clan action')
          .addChoices(
            { name: 'list', value: 'list' },
            { name: 'join', value: 'join' },
            { name: 'deposit', value: 'deposit' }
          )
      )
      .addStringOption((o) => o.setName('id').setDescription('Clan to join').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('estate')
      .setDescription('Housing')
      .addIntegerOption((o) => o.setName('buy').setDescription('Estate tier to purchase').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('market')
      .setDescription('Item market')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Market action')
          .addChoices(
            { name: 'browse', value: 'browse' },
            { name: 'sell', value: 'sell' },
            { name: 'buy', value: 'buy' }
          )
      )
      .addStringOption((o) => o.setName('item').setDescription('Item to sell').setAutocomplete(true))
      .addIntegerOption((o) => o.setName('quantity').setDescription('Quantity'))
      .addIntegerOption((o) => o.setName('price').setDescription('Price per unit'))
      .addIntegerOption((o) => o.setName('listing').setDescription('Listing to buy').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('gold')
      .setDescription('Royal relic exchange')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Exchange action')
          .addChoices(
            { name: 'browse', value: 'browse' },
            { name: 'sell', value: 'sell' },
            { name: 'buy', value: 'buy' }
          )
      )
      .addIntegerOption((o) => o.setName('amount').setDescription('Gold amount'))
      .addIntegerOption((o) => o.setName('price').setDescription('Price per unit'))
      .addIntegerOption((o) => o.setName('listing').setDescription('Listing to buy').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('forge')
      .setDescription('Forge gear from recipes')
      .addStringOption((o) =>
        o.setName('recipe').setDescription('Recipe id (list with /forge no recipe)').setAutocomplete(true)
      ),
    new SlashCommandBuilder()
      .setName('gym')
      .setDescription('Training yard multiplier')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('List or set gym')
          .addChoices({ name: 'list', value: 'list' }, { name: 'set', value: 'set' })
      )
      .addStringOption((o) =>
        o.setName('id').setDescription('Gym id when setting').setAutocomplete(true)
      ),
    new SlashCommandBuilder()
      .setName('worker')
      .setDescription('Train worker stats (company jobs)')
      .addStringOption((o) =>
        o
          .setName('stat')
          .setDescription('Worker stat')
          .setRequired(true)
          .addChoices(
            { name: 'Manual Labor', value: 'manual_labor' },
            { name: 'Intelligence', value: 'intelligence' },
            { name: 'Endurance', value: 'endurance' },
            { name: 'Technique', value: 'technique' }
          )
      )
      .addIntegerOption((o) => o.setName('sets').setDescription('Sets 1-20').setMinValue(1).setMaxValue(20)),
    new SlashCommandBuilder()
      .setName('class')
      .setDescription('View or choose your GoT class path (Squire → Knight/Maester/Ranger…)')
      .addStringOption((o) =>
        o.setName('choose').setDescription('Swear a class oath when available').setAutocomplete(true)
      ),
    new SlashCommandBuilder()
      .setName('character')
      .setDescription('View combat power, gear bonuses, and what your stats do'),
    new SlashCommandBuilder()
      .setName('equip')
      .setDescription('Equip weapon, armor, or gear')
      .addStringOption((o) => o.setName('item').setDescription('Gear from inventory').setRequired(true).setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('unequip')
      .setDescription('Unequip a slot')
      .addStringOption((o) =>
        o
          .setName('slot')
          .setDescription('Slot')
          .setRequired(true)
          .addChoices(
            { name: 'weapon', value: 'weapon' },
            { name: 'armor', value: 'armor' },
            { name: 'gear', value: 'gear' }
          )
      ),
    new SlashCommandBuilder()
      .setName('company')
      .setDescription('Company work shift')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Action')
          .addChoices({ name: 'list', value: 'list' }, { name: 'join', value: 'join' })
      )
      .addStringOption((o) => o.setName('id').setDescription('Company to join').setAutocomplete(true)),
    new SlashCommandBuilder()
      .setName('drug')
      .setDescription('Boosters with cooldowns')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('List or use')
          .addChoices({ name: 'list', value: 'list' }, { name: 'use', value: 'use' })
      )
      .addStringOption((o) =>
        o
          .setName('id')
          .setDescription('Drug id')
          .addChoices(
            { name: 'Morale Tonic', value: 'morale_tonic' },
            { name: 'Focus Tea', value: 'focus_tea' },
            { name: 'Resolve Pill', value: 'resolve_pill' },
            { name: 'Booster Serum', value: 'booster_serum' }
          )
      ),
    new SlashCommandBuilder()
      .setName('explore')
      .setDescription('Navigate areas (from zip world data)')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Explore action')
          .setRequired(true)
          .addChoices(
            { name: 'look', value: 'look' },
            { name: 'move', value: 'move' },
            { name: 'travel', value: 'travel' },
            { name: 'mine', value: 'mine' },
            { name: 'hunt', value: 'hunt' },
            { name: 'attack', value: 'attack' },
            { name: 'flee', value: 'flee' }
          )
      )
      .addStringOption((o) =>
        o
          .setName('direction')
          .setDescription('Direction to move')
          .addChoices(
            { name: 'North', value: 'north' },
            { name: 'South', value: 'south' },
            { name: 'East', value: 'east' },
            { name: 'West', value: 'west' },
            { name: 'Up', value: 'up' }
          )
      )
      .addStringOption((o) =>
        o
          .setName('area')
          .setDescription('Area id for travel')
          .addChoices(
            { name: 'Winterfell', value: 'winterfell' },
            { name: "King's Landing", value: 'kings_landing' },
            { name: 'Oldtown', value: 'oldtown' },
            { name: 'The Wall', value: 'the_wall' }
          )
      ),
    new SlashCommandBuilder()
      .setName('escape')
      .setDescription('Leave maester tent or black cells')
      .addStringOption((o) =>
        o
          .setName('place')
          .setDescription('Where you are confined')
          .setRequired(true)
          .addChoices(
            { name: "Maester's tent", value: 'hospital' },
            { name: 'Black cells', value: 'jail' }
          )
      )
      .addStringOption((o) =>
        o
          .setName('method')
          .setDescription('How to escape')
          .addChoices(
            { name: 'Pay coins', value: 'pay' },
            { name: 'Use item', value: 'item' },
            { name: 'Rally morale (tent only)', value: 'ce' }
          )
      ),
    new SlashCommandBuilder()
      .setName('talk')
      .setDescription('Talk to NPC in current room')
      .addStringOption((o) =>
        o
          .setName('npc')
          .setDescription('NPC id')
          .setRequired(true)
          .addChoices(
            { name: 'Maester', value: 'maester' },
            { name: 'Goldcloak Captain', value: 'goldcloak' },
            { name: 'Septon', value: 'septon' },
            { name: 'Hedge Knight', value: 'hedge_knight' }
          )
      ),
    new SlashCommandBuilder()
      .setName('commodity')
      .setDescription('Trade commodities')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Trade action')
          .addChoices({ name: 'list', value: 'list' }, { name: 'buy', value: 'buy' }, { name: 'sell', value: 'sell' })
      )
      .addStringOption((o) => o.setName('id').setDescription('Commodity to trade').setAutocomplete(true))
      .addIntegerOption((o) => o.setName('quantity').setDescription('Quantity')),
    new SlashCommandBuilder().setName('delve').setDescription('Enter ancient crypts'),
    new SlashCommandBuilder()
      .setName('grabbag')
      .setDescription('Relic chests')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Grab bag action')
          .addChoices(
            { name: 'buy', value: 'buy' },
            { name: 'open', value: 'open' }
          )
      )
      .addIntegerOption((o) => o.setName('count').setDescription('How many to buy or open')),
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('Top lords')
      .addStringOption((o) =>
        o
          .setName('type')
          .setDescription('Leaderboard type')
          .addChoices(
            { name: 'level', value: 'level' },
            { name: 'wealth', value: 'wealth' },
            { name: 'battle', value: 'battle' },
            { name: 'strength', value: 'strength' },
            { name: 'defense', value: 'defense' },
            { name: 'speed', value: 'speed' },
            { name: 'dexterity', value: 'dexterity' },
            { name: 'pvp', value: 'pvp' }
          )
      ),
    new SlashCommandBuilder()
      .setName('world')
      .setDescription('Change region')
      .addStringOption((o) =>
        o
          .setName('id')
          .setDescription('Region')
          .setRequired(true)
          .addChoices(
            { name: 'The North', value: 'north' },
            { name: 'Riverlands', value: 'riverlands' },
            { name: 'The West', value: 'west' },
            { name: 'The Reach', value: 'reach' }
          )
      ),
    new SlashCommandBuilder()
      .setName('house')
      .setDescription('Great Houses — pledge allegiance')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('list or join')
          .addChoices({ name: 'list', value: 'list' }, { name: 'join', value: 'join' })
      )
      .addStringOption((o) =>
        o
          .setName('id')
          .setDescription('House id')
          .addChoices(
            { name: 'Stark', value: 'stark' },
            { name: 'Lannister', value: 'lannister' },
            { name: 'Baratheon', value: 'baratheon' },
            { name: 'Tyrell', value: 'tyrell' },
            { name: 'Greyjoy', value: 'greyjoy' },
            { name: 'Targaryen', value: 'targaryen' }
          )
      ),
    new SlashCommandBuilder()
      .setName('guild')
      .setDescription('Player guilds — found, join, treasury')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Action')
          .addChoices(
            { name: 'list', value: 'list' },
            { name: 'create', value: 'create' },
            { name: 'join', value: 'join' },
            { name: 'leave', value: 'leave' },
            { name: 'deposit', value: 'deposit' }
          )
      )
      .addStringOption((o) => o.setName('name').setDescription('Guild name (create)'))
      .addStringOption((o) => o.setName('tag').setDescription('Guild tag 2-5 chars (create)'))
      .addIntegerOption((o) => o.setName('id').setDescription('Guild to join').setAutocomplete(true))
      .addIntegerOption((o) => o.setName('amount').setDescription('Gold to deposit')),
    new SlashCommandBuilder()
      .setName('realm')
      .setDescription('Realm map — regions and owners')
      .addStringOption((o) =>
        o
          .setName('region')
          .setDescription('Region detail or all lands map')
          .addChoices(
            { name: '🗺 All lands (map + resources)', value: 'all' },
            { name: 'Winterfell', value: 'winterfell' },
            { name: 'Dreadfort', value: 'dreadfort' },
            { name: 'White Harbor', value: 'white_harbor' },
            { name: 'The Twins', value: 'twins' },
            { name: 'Riverrun', value: 'riverrun' },
            { name: "King's Landing", value: 'kings_landing' },
            { name: "Storm's End", value: 'storms_end' },
            { name: 'Highgarden', value: 'highgarden' },
            { name: 'Casterly Rock', value: 'casterly_rock' },
            { name: 'Oldtown', value: 'oldtown' },
            { name: 'Pyke', value: 'pyke' },
            { name: 'Dragonstone', value: 'dragonstone' }
          )
      ),
    new SlashCommandBuilder()
      .setName('war')
      .setDescription('Siege warfare')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('War action')
          .addChoices(
            { name: 'status', value: 'status' },
            { name: 'declare', value: 'declare' },
            { name: 'contribute', value: 'contribute' }
          )
      )
      .addStringOption((o) =>
        o
          .setName('region')
          .setDescription('Target region (declare)')
          .addChoices(
            { name: 'Winterfell', value: 'winterfell' },
            { name: 'Dreadfort', value: 'dreadfort' },
            { name: 'White Harbor', value: 'white_harbor' },
            { name: 'The Twins', value: 'twins' },
            { name: 'Riverrun', value: 'riverrun' },
            { name: "King's Landing", value: 'kings_landing' },
            { name: "Storm's End", value: 'storms_end' },
            { name: 'Highgarden', value: 'highgarden' },
            { name: 'Casterly Rock', value: 'casterly_rock' },
            { name: 'Oldtown', value: 'oldtown' },
            { name: 'Pyke', value: 'pyke' },
            { name: 'Dragonstone', value: 'dragonstone' }
          )
      ),
    new SlashCommandBuilder()
      .setName('admin')
      .setDescription('Admin tools')
      .addStringOption((o) =>
        o
          .setName('action')
          .setDescription('Admin action')
          .setRequired(true)
          .addChoices(
            { name: 'givecoins', value: 'givecoins' },
            { name: 'setlevel', value: 'setlevel' },
            { name: 'ban', value: 'ban' },
            { name: 'unban', value: 'unban' }
          )
      )
      .addUserOption((o) => o.setName('target').setDescription('Target user').setRequired(true))
      .addIntegerOption((o) => o.setName('value').setDescription('Coins or level value'))
  ].map((c) => c.toJSON());
}
