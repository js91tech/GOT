/** Shared UI polish — flash auto-dismiss, toasts, form guards. */
(function () {
  function showToast(message, kind) {
    if (!message) return;
    let el = document.getElementById('realm-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'realm-toast';
      el.className = 'realm-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `realm-toast realm-toast--show${kind === 'ok' ? ' realm-toast--ok' : ''}`;
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.classList.remove('realm-toast--show');
    }, 5000);
    if (kind === 'ok' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('Westeros Realm', { body: message, tag: 'westeros-realm' });
      } catch {
        /* ignore */
      }
    }
  }

  window.realmToast = showToast;

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    document.addEventListener(
      'click',
      () => {
        Notification.requestPermission().catch(() => {});
      },
      { once: true }
    );
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.flash-wrap, .flash').forEach((flash) => {
      const text = flash.textContent?.trim();
      if (text) showToast(text, flash.classList.contains('error') ? 'error' : 'ok');
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
})();
