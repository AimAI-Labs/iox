// Match the settings page's Sonner toast inside an isolated website DOM surface.
function createIoxToast({ theme = 'system', onDismiss = () => {} } = {}) {
  const host = document.createElement('div');
  host.setAttribute('data-iox-toast-host', '');
  host.style.cssText = 'position:fixed;z-index:2147483647;top:32px;left:50%;transform:translateX(-50%);width:min(356px,calc(100vw - 32px));pointer-events:none';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{all:initial}
    *{box-sizing:border-box}
    .toast{position:relative;display:flex;align-items:center;gap:6px;padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--fg);box-shadow:0 4px 12px #0000001a;font:13px ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-wrap:anywhere;pointer-events:auto;animation:enter 180ms ease-out}
    .toast{--bg:#fff;--fg:hsl(0 0% 9%);--border:hsl(0 0% 93%);--close-bg:#fff;--close-fg:hsl(0 0% 9%);--close-border:hsl(0 0% 93%)}
    .toast[data-type=success]{--bg:hsl(143 85% 96%);--fg:hsl(140 100% 27%);--border:hsl(145 92% 87%)}
    .toast[data-type=error]{--bg:hsl(359 100% 97%);--fg:hsl(360 100% 45%);--border:hsl(359 100% 94%)}
    .toast[data-theme=dark]{--bg:#000;--fg:hsl(0 0% 99%);--border:hsl(0 0% 20%);--close-bg:#000;--close-fg:hsl(0 0% 99%);--close-border:hsl(0 0% 20%)}
    .toast[data-theme=dark][data-type=success]{--bg:hsl(150 100% 6%);--fg:hsl(150 86% 65%);--border:hsl(147 100% 12%)}
    .toast[data-theme=dark][data-type=error]{--bg:hsl(358 76% 10%);--fg:hsl(358 100% 81%);--border:hsl(357 89% 16%)}
    .content{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .title{font-weight:500;line-height:1.5}.description{font-weight:400;line-height:1.4}
    .icon{display:flex;align-items:center;justify-content:center;flex-shrink:0;width:16px;height:16px;margin-right:2px}
    .icon svg{width:20px;height:20px;flex-shrink:0}
    [data-type=loading] .icon svg{animation:spin 800ms linear infinite}
    button{position:absolute;top:0;left:0;transform:translate(-35%,-35%);display:grid;place-items:center;width:20px;height:20px;padding:0;border:1px solid var(--close-border);border-radius:50%;background:var(--close-bg);color:var(--close-fg);cursor:pointer}
    button:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}button svg{width:12px;height:12px}
    @keyframes enter{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){.toast,.icon svg{animation:none!important}}
  </style><section class="toast" role="status" aria-live="polite" aria-atomic="true">
    <button type="button" aria-label="关闭提示 / Dismiss notification"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    <span class="icon" aria-hidden="true"></span><div class="content"><div class="title"></div><div class="description"></div></div>
  </section>`;
  const toast = root.querySelector('.toast');
  toast.dataset.theme = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  const icons = {
    loading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" opacity=".2"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>',
    success: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="m7 12 3 3 7-7" fill="none" stroke="var(--bg)" stroke-width="2"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 6v7m0 3v2" stroke="var(--bg)" stroke-width="2"/></svg>',
  };
  let timer = null, duration = 3500, removed = false;
  function dismiss() {
    if (removed) return;
    removed = true;
    clearTimeout(timer);
    host.remove();
    onDismiss();
  }
  function scheduleDismiss() {
    clearTimeout(timer);
    if (duration > 0) timer = setTimeout(dismiss, duration);
  }
  root.querySelector('button').addEventListener('click', dismiss);
  toast.addEventListener('pointerenter', () => clearTimeout(timer));
  toast.addEventListener('pointerleave', scheduleDismiss);
  (document.body || document.documentElement).appendChild(host);
  return {
    dismiss,
    update({ type, title, description, duration: nextDuration = 3500 }) {
      if (removed) return;
      toast.dataset.type = type;
      root.querySelector('.icon').innerHTML = icons[type] || icons.error;
      root.querySelector('.title').textContent = title;
      root.querySelector('.description').textContent = description;
      duration = nextDuration;
      scheduleDismiss();
    },
  };
}
