/** Shared UI polish — flash auto-dismiss and double-submit guards. */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.flash-wrap, .flash').forEach((flash) => {
    if (flash.classList.contains('flash-wrap')) {
      setTimeout(() => {
        flash.classList.add('flash-wrap--hide');
        setTimeout(() => flash.remove(), 400);
      }, 6000);
    } else {
      setTimeout(() => {
        flash.style.opacity = '0';
        flash.style.transition = 'opacity 0.35s ease';
        setTimeout(() => flash.remove(), 400);
      }, 6000);
    }
  });

  document.querySelectorAll('form[action="/bank"], form[action="/crime"], form[action="/pvp"]').forEach((form) => {
    form.addEventListener('submit', () => {
      const btn = form.querySelector('button[type="submit"]');
      if (btn && !btn.disabled) btn.disabled = true;
    });
  });
});
