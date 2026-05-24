/** Dashboard tile interactions — mission art swap, wheel spin. */
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
});
