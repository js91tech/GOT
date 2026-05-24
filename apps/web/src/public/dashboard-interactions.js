/** Dashboard tile interactions — mission art, wheel spin, flash dismiss, live timers. */
document.addEventListener('DOMContentLoaded', () => {
  const missionSelect = document.querySelector('.action-tile--mission select[name="mission"]');
  const missionArt = document.querySelector('.tile-art--mission');
  if (missionSelect && missionArt) {
    const applyMissionArt = () => {
      const opt = missionSelect.selectedOptions[0];
      const url = opt?.dataset?.image || missionArt.dataset.default;
      if (url) missionArt.style.backgroundImage = `url('${url}')`;
    };
    missionSelect.addEventListener('change', applyMissionArt);
    applyMissionArt();
  }

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

  /** Format ms remaining as human countdown. */
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

  document.querySelectorAll('form.tile-form, form.work-chip, form.wheel-form').forEach((form) => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) btn.disabled = true;
    });
  });
});
