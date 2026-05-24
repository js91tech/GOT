/** Dashboard tile interactions — mission art, wheel spin, flash dismiss, live timers. */
document.addEventListener('DOMContentLoaded', () => {
  const PREFS_KEY = 'westeros-dash-prefs';

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function savePrefs(partial) {
    const prefs = { ...loadPrefs(), ...partial };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  const prefs = loadPrefs();

  const missionSelect = document.querySelector('.action-tile--mission select[name="mission"]');
  const missionArt = document.querySelector('.tile-art--mission');
  if (missionSelect && missionArt) {
    if (prefs.mission) missionSelect.value = prefs.mission;
    const applyMissionArt = () => {
      const opt = missionSelect.selectedOptions[0];
      const url = opt?.dataset?.image || missionArt.dataset.default;
      if (url) missionArt.style.backgroundImage = `url('${url}')`;
    };
    missionSelect.addEventListener('change', () => {
      savePrefs({ mission: missionSelect.value });
      applyMissionArt();
    });
    applyMissionArt();
  }

  document.querySelectorAll('.action-tile--train select[name="stat"]').forEach((sel) => {
    if (prefs.trainStat) sel.value = prefs.trainStat;
    sel.addEventListener('change', () => savePrefs({ trainStat: sel.value }));
  });

  document.querySelectorAll('.action-tile--worker select[name="stat"]').forEach((sel) => {
    if (prefs.workerStat) sel.value = prefs.workerStat;
    sel.addEventListener('change', () => savePrefs({ workerStat: sel.value }));
  });

  document.querySelectorAll('.action-tile--train input[name="sets"]').forEach((input) => {
    if (prefs.trainSets) input.value = prefs.trainSets;
    input.addEventListener('change', () => savePrefs({ trainSets: input.value }));
  });

  document.querySelectorAll('.action-tile--worker input[name="sets"]').forEach((input) => {
    if (prefs.workerSets) input.value = prefs.workerSets;
    input.addEventListener('change', () => savePrefs({ workerSets: input.value }));
  });

  const wheelForm = document.querySelector('.action-tile--wheel .wheel-form');
  const wheelDisc = document.querySelector('.wheel-disc');
  if (wheelForm && wheelDisc) {
    wheelForm.addEventListener('submit', () => {
      wheelDisc.classList.add('wheel-disc--spinning');
    });
  }

  const flash = document.querySelector('.flash-wrap');
  if (flash) {
    setTimeout(() => {
      flash.classList.add('flash-wrap--hide');
      setTimeout(() => flash.remove(), 400);
    }, 6000);
  }

  function formatCountdown(ms) {
    if (ms <= 0) return '0s';
    const totalSec = Math.ceil(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) return secs ? `${mins}m ${secs}s` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins ? `${hrs}h ${remMins}m` : `${hrs}h`;
  }

  const workBtn = document.querySelector('.work-chip button[type="submit"]');
  const workChip = document.querySelector('.status-chip[data-work-until]');

  function tickCountdowns() {
    const now = Date.now();
    document.querySelectorAll('[data-countdown-until]').forEach((el) => {
      const until = el.dataset.countdownUntil;
      if (!until) return;
      const left = new Date(until).getTime() - now;
      const prefix = el.dataset.countdownPrefix || '';
      const suffix = el.dataset.countdownSuffix || '';
      if (left <= 0) {
        if (el.dataset.countdownDone) {
          el.textContent = el.dataset.countdownDone;
        }
        el.classList.remove('status-chip--wait');
        el.classList.add('status-chip--ok');
        return;
      }
      el.textContent = `${prefix}${formatCountdown(left)}${suffix}`;
    });

    if (workBtn && workBtn.dataset.workUntil) {
      const left = new Date(workBtn.dataset.workUntil).getTime() - now;
      if (left <= 0) {
        workBtn.disabled = false;
        workBtn.removeAttribute('title');
        workBtn.textContent = 'Clock in';
      } else {
        workBtn.disabled = true;
        workBtn.textContent = `Wait ${formatCountdown(left)}`;
      }
    }

    if (workChip && workChip.dataset.workUntil) {
      const left = new Date(workChip.dataset.workUntil).getTime() - now;
      if (left <= 0) {
        workChip.textContent = 'Work ready';
        workChip.classList.remove('status-chip--wait');
        workChip.classList.add('status-chip--ok');
      } else {
        workChip.textContent = `Work in ${formatCountdown(left)}`;
      }
    }
  }

  tickCountdowns();
  setInterval(tickCountdowns, 1000);

  /** Optional light refresh from /me every 90s on dashboard. */
  if (document.querySelector('.page-dashboard')) {
    setInterval(async () => {
      try {
        const res = await fetch('/me', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = await res.json();
        const s = data.status;
        if (!s) return;
        document.querySelectorAll('.resource-stone[data-icon="ce"] .resource-value').forEach((el) => {
          const cap = s.morale_regen_cap;
          el.textContent = `${data.player.ce}/${cap}`;
        });
        document.querySelectorAll('.resource-stone[data-icon="focus"] .resource-value').forEach((el) => {
          const cap = s.focus_regen_cap;
          el.textContent = `${data.player.focus}/${cap}`;
        });
      } catch {
        /* ignore poll errors */
      }
    }, 90000);
  }

  const guardedForms =
    'form.tile-form, form.work-chip, form.wheel-form, form[action="/bank"], form[action="/crime"], form[action="/pvp"], form.daily-quest-claim';
  document.querySelectorAll(guardedForms).forEach((form) => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) btn.disabled = true;
    });
  });
});
