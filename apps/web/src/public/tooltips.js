/**
 * Hover / focus tooltips for every web dashboard action.
 * Binds automatically from form actions, nav links, and stat labels.
 */
(function () {
  const NAV = {
    '/dashboard': 'Your hub: stats, training, missions, bank, and inventory.',
    '/shop': 'Buy relics and consumables with coins.',
    '/pvp': 'Attack, mug, rob other players, or bust allies out of jail.',
    '/explore': 'Move on the map, travel between areas, mine, and talk to NPCs.',
    '/advanced': 'Clans, estates, education, companies, forge, delve, commodities.',
    '/leaderboard': 'Rankings by level, wealth, battle power, stats, or PvP wins.',
    '/login': 'Sign in with Discord — same character as the bot.',
    '/logout': 'End your browser session.'
  };

  const FORM = {
    '/train': {
      panel: 'Spend focus to raise a combat stat (STR, DEF, SPD, DEX). Higher stats improve PvP and missions.',
      stat: 'Which combat stat to train this session.',
      sets: 'Number of training sets (1–20). Each set costs focus.',
      submit: 'Run training and spend focus.'
    },
    '/crime': {
      panel: 'Run a curse mission for coins and XP. Failed missions can send you to the infirmary or jail.',
      mission: 'Missions locked until you reach the listed level.',
      submit: 'Start the selected mission.'
    },
    '/work': {
      panel: 'Clock in at your company for coins. Join a company under Advanced first.',
      submit: 'Complete a work shift.'
    },
    '/wheel': {
      panel: 'Daily prize wheel — limited spins shown on your stat cards.',
      submit: 'Spin once (uses a daily spin if available).'
    },
    '/lounge': {
      panel: 'CE Lounge: restore or boost cursed energy between missions.',
      tea: 'Tea — restore a portion of CE.',
      vow: 'Binding vow — special CE bonus (cooldown may apply).',
      refill: 'Refill — top up your CE pool.'
    },
    '/escape': {
      panel: 'Leave the infirmary or Prison Realm early.',
      submit: 'Attempt escape with the chosen method.'
    },
    '/bank': {
      panel: 'Treasury: move coins between pocket and bank, invest, or collect returns.',
      action: 'Deposit, withdraw, invest, or collect matured investment.',
      amount: 'Coin amount for deposit, withdraw, or invest.',
      submit: 'Execute treasury action.'
    },
    '/worker': {
      panel: 'Train worker stats used for company and advanced systems.',
      stat: 'Labor, Intelligence, Endurance, or Technique.',
      sets: 'Training sets (1–20).',
      submit: 'Train the selected worker stat.'
    },
    '/gym': {
      panel: 'Set your active gym (affects training bonuses).',
      submit: 'Switch to Cursed Pit gym.'
    },
    '/equip': {
      panel: 'Equip a weapon or relic from inventory by item ID.',
      item: 'Item id from your inventory list (e.g. cursed_blade).',
      submit: 'Equip that item.'
    },
    '/shop/buy': {
      panel: 'Purchase shop stock with on-hand coins.',
      quantity: 'How many to buy.',
      submit: 'Buy at listed price.'
    },
    '/pvp': {
      panel: 'Player vs player — same rules as Discord attack/mug/rob.',
      submit: 'Execute the selected PvP action.'
    },
    '/bust': {
      panel: 'Free this player from Prison Realm (ally help).',
      submit: 'Attempt bust.'
    },
    '/drug': {
      panel: 'Use a drug consumable (default CE Shot boosts CE).',
      drugId: 'Drug item id from inventory or shop.',
      submit: 'Take the drug.'
    },
    '/explore': {
      panel: 'Exploration actions for your current map.',
      submit: 'Perform the selected explore action.'
    }
  };

  const ADVANCED_TYPE = {
    joinClan: 'Join a sorcerer clan by id (listed above).',
    buyEstate: 'Buy a property tier for passive benefits.',
    enroll: 'Enroll in an education course by course id.',
    joinCompany: 'Join a company to unlock work shifts on the dashboard.',
    forge: 'Craft an item from a recipe id if you have materials.',
    delve: 'Start a delve run for rare loot.',
    endDelve: 'End your active delve and collect results.',
    grabbag: 'Open a capsule / grab bag from inventory.',
    commodity: 'Buy or sell commodities at the current market price.'
  };

  const STAT = {
    Coins: 'Cash on hand — lost partially when mugged or robbed.',
    Bank: 'Stored coins — safer from PvP theft.',
    CE: 'Cursed Energy — spent on techniques and hospital CE escape.',
    Focus: 'Spent when training combat or worker stats.',
    'Wheel spins': 'Daily wheel attempts remaining.',
    Company: 'Your employer id — required to clock in at work.'
  };

  const ESCAPE_BUTTON = {
    'Pay medical bill': 'Pay coins to leave Shoko\'s infirmary immediately.',
    'CE escape (40 CE)': 'Spend 40 CE to walk out of the infirmary.',
    'Use Reversal Kit': 'Consume a Reversal Kit from inventory.',
    'Pay bail': 'Pay coins to leave Prison Realm early.',
    'Prison Key': 'Use a Prison Key item from inventory.',
    'Ask ally to bust you': 'Open PvP so a friend can bust you out.'
  };

  const PVP_ACTION = {
    attack: 'Standard PvP fight — can hospitalize the loser.',
    mug: 'Steal some of the target\'s on-hand coins.',
    rob: 'Riskier theft attempt for more coins.'
  };

  const LEADERBOARD = {
    level: 'Highest character levels.',
    wealth: 'Coins plus bank balance.',
    battle: 'Overall combat rating.',
    strength: 'Strength stat leaders.',
    defense: 'Defense stat leaders.',
    speed: 'Speed stat leaders.',
    dexterity: 'Dexterity stat leaders.',
    pvp: 'Most PvP wins.'
  };

  const EXPLORE_ACTION = {
    move: 'Step one tile north/south/east/west/up on the current map.',
    travel: 'Fast travel to a major area (level gates may apply).',
    mine: 'Mine the current room for resources.',
    talk: 'Speak with an NPC for lore, hints, or quests.'
  };

  let tipEl = null;

  function ensureTipEl() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'game-tooltip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function showTip(target, text) {
    if (!text) return;
    const el = ensureTipEl();
    el.textContent = text;
    el.hidden = false;
    const r = target.getBoundingClientRect();
    const pad = 8;
    let left = r.left + r.width / 2;
    let top = r.top - pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transform = 'translate(-50%, -100%)';
    requestAnimationFrame(() => {
      const tr = el.getBoundingClientRect();
      if (tr.left < 8) left += 8 - tr.left;
      if (tr.right > window.innerWidth - 8) left -= tr.right - window.innerWidth + 8;
      if (tr.top < 8) {
        top = r.bottom + pad;
        el.style.transform = 'translate(-50%, 0)';
      }
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
    });
  }

  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  function bind(el, text) {
    if (!el || el.dataset.tipBound) return;
    el.dataset.tipBound = '1';
    el.setAttribute('aria-describedby', 'game-tooltip');
    const show = () => showTip(el, text);
    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hideTip);
    el.addEventListener('blur', hideTip);
  }

  function advancedTip(form) {
    const type = form.querySelector('input[name="type"]')?.value;
    if (type && ADVANCED_TYPE[type]) return ADVANCED_TYPE[type];
    const act = form.querySelector('button[name="action"]')?.value;
    if (act === 'buy' || act === 'sell') return `Commodity: ${act} at market price.`;
    return 'Advanced progression system.';
  }

  function exploreTip(form) {
    const act = form.querySelector('input[name="action"]')?.value;
    return EXPLORE_ACTION[act] || FORM['/explore'].panel;
  }

  function bindForms() {
    document.querySelectorAll('form[action]').forEach((form) => {
      const path = form.getAttribute('action');
      if (path === '/advanced') {
        bind(form.querySelector('button'), advancedTip(form));
        const h3 = form.closest('.panel')?.querySelector('h3');
        if (h3) bind(h3, advancedTip(form));
        form.querySelectorAll('input, select, button').forEach((el) => {
          const name = el.getAttribute('name');
          if (name === 'clanId') bind(el, 'Clan id, e.g. tokyo');
          if (name === 'tier') bind(el, 'Estate tier number to purchase');
          if (name === 'courseId') bind(el, 'Course id from the list above');
          if (name === 'companyId') bind(el, 'Company id, e.g. jujutsu_ops');
          if (name === 'recipeId') bind(el, 'Recipe id, e.g. cursed_blade');
          if (name === 'commId') bind(el, 'Commodity id, e.g. cursed_rice');
          if (name === 'qty') bind(el, 'Quantity to trade');
        });
        return;
      }
      if (path === '/explore') {
        bind(form.querySelector('button[type="submit"], button'), exploreTip(form));
        const h3 = form.closest('.panel')?.querySelector('h3');
        if (h3) bind(h3, exploreTip(form));
        return;
      }
      if (path === '/lounge') {
        const act = form.querySelector('input[name="action"]')?.value;
        const btn = form.querySelector('button');
        if (btn && act && FORM['/lounge'][act]) bind(btn, FORM['/lounge'][act]);
        return;
      }
      const spec = FORM[path];
      if (!spec) return;
      const panel = form.closest('.panel, .jjk-panel, .action-card, .action-tile, .shelf-panel, .lounge-panel, .escape-actions, .shop-card, .pvp-card');
      if (panel) {
        const h3 = panel.querySelector('h3');
        if (h3 && spec.panel) bind(h3, spec.panel);
      }
      form.querySelectorAll('button[type="submit"], button:not([type])').forEach((btn) => {
        const label = btn.textContent.trim();
        if (ESCAPE_BUTTON[label]) bind(btn, ESCAPE_BUTTON[label]);
        else bind(btn, spec.submit || spec.panel);
        if (path === '/pvp' && btn.name === 'action') bind(btn, PVP_ACTION[btn.value] || spec.submit);
      });
      form.querySelectorAll('select, input:not([type="hidden"])').forEach((el) => {
        const key = el.getAttribute('name');
        if (spec[key]) bind(el, spec[key]);
      });
    });
  }

  function bindNav() {
    document.querySelectorAll('nav a[href]').forEach((a) => {
      const href = a.getAttribute('href').split('?')[0];
      if (NAV[href]) bind(a, NAV[href]);
    });
    document.querySelectorAll('a.btn[href="/login"]').forEach((a) => bind(a, NAV['/login']));
  }

  function bindStats() {
    document.querySelectorAll('.stat-card, .resource-stone').forEach((card) => {
      const label = (card.querySelector('.label') || card.querySelector('.resource-label'))?.textContent?.trim();
      if (STAT[label]) bind(card, STAT[label]);
    });
  }

  function bindLeaderboard() {
    document.querySelectorAll('a[href^="/leaderboard"]').forEach((a) => {
      const m = a.getAttribute('href').match(/type=(\w+)/);
      if (m && LEADERBOARD[m[1]]) bind(a, LEADERBOARD[m[1]]);
    });
  }

  function bindHeadings() {
    document.querySelectorAll('.combat-bar span').forEach((span) => {
      const t = span.textContent.trim();
      if (t.startsWith('STR')) bind(span, 'Strength — melee damage and training.');
      if (t.startsWith('DEF')) bind(span, 'Defense — reduces damage taken.');
      if (t.startsWith('SPD')) bind(span, 'Speed — turn order and evasion.');
      if (t.startsWith('DEX')) bind(span, 'Dexterity — accuracy and crit chance.');
    });
  }

  function init() {
    ensureTipEl();
    bindNav();
    bindForms();
    bindStats();
    bindLeaderboard();
    bindHeadings();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
