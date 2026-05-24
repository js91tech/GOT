/** Shared UI polish — flash auto-dismiss on any page. */
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
});
