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

  const confinementPanel = document.querySelector('[data-confinement-until]');
  const confinementMins = document.querySelector('.confinement-mins');
  if (confinementPanel && confinementMins) {
    const until = confinementPanel.dataset.confinementUntil;
    if (until) {
      const tick = () => {
        const left = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 60000));
        confinementMins.textContent = left;
      };
      tick();
      setInterval(tick, 30000);
    }
  }

  const workChip = document.querySelector('[data-work-mins]');
  if (workChip) {
    let mins = parseInt(workChip.dataset.workMins, 10) || 0;
    const tickWork = () => {
      if (mins <= 0) {
        workChip.textContent = 'Work ready';
        workChip.classList.remove('status-chip--wait');
        workChip.classList.add('status-chip--ok');
        return;
      }
      workChip.textContent = `Work in ${mins}m`;
      mins -= 1;
    };
    setInterval(tickWork, 60000);
  }
});
