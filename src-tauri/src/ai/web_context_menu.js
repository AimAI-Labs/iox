/**
 * IOX Web 卡片自定义右键菜单。
 *
 * 通过初始化脚本注入到官网页面，使用 closed shadow root 隔离站点样式。
 * 只接管页面空白区域的右键：输入框、可编辑区域与媒体元素保留浏览器原生菜单，
 * 因此粘贴、拼写检查等能力不会丢失。切换 AI 通过固定的哨兵 URL 交给 Rust 处理，
 * 页面本身不会获得任何 Tauri IPC 权限。
 */
function installIoxContextMenu(options) {
  try {
    if (window.top !== window) return false;
    if (window.__ioxContextMenuDispose) {
      try { window.__ioxContextMenuDispose(); } catch (_) {}
    }

    const language = options.language === 'zh' ? 'zh' : 'en';
    const text = language === 'zh'
      ? { copy: '复制选中内容', reload: '刷新页面', switchAi: '切换 AI', current: '当前', empty: '没有可切换的 AI' }
      : { copy: 'Copy selection', reload: 'Reload page', switchAi: 'Switch AI', current: 'Current', empty: 'No other AI configured' };
    const actions = Array.isArray(options.actions) ? options.actions.filter((item) => item && item.id && item.name) : [];
    const dark = options.theme === 'dark'
      || (options.theme !== 'light'
        && window.matchMedia
        && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const host = document.createElement('div');
    host.id = '__iox_context_menu_host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:none;';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .menu, .submenu {
        box-sizing: border-box;
        position: fixed;
        min-width: 208px;
        padding: 6px;
        border-radius: 14px;
        font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: ${dark ? '#e4e4e7' : '#27272a'};
        background: ${dark ? 'rgba(24,24,27,0.92)' : 'rgba(255,255,255,0.92)'};
        border: 1px solid ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'};
        box-shadow: 0 18px 48px rgba(0,0,0,${dark ? '0.45' : '0.18'});
        backdrop-filter: blur(24px) saturate(150%);
        -webkit-backdrop-filter: blur(24px) saturate(150%);
        pointer-events: auto;
        user-select: none;
        overflow: auto;
        max-height: min(70vh, 520px);
        animation: iox-menu-in 120ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .submenu { display: none; min-width: 196px; padding: 8px; }
      .submenu.open { display: flex; flex-direction: column; gap: 6px; }
      @keyframes iox-menu-in {
        from { opacity: 0; transform: scale(0.97) translateY(-2px); }
        to { opacity: 1; transform: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .menu, .submenu { animation: none; }
      }
      .item {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        box-sizing: border-box;
        padding: 7px 9px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        outline: none;
        white-space: nowrap;
      }
      .item:hover, .item:focus-visible { background: ${dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.055)'}; }
      .item:disabled { opacity: 0.5; cursor: default; }
      .item .glyph { width: 16px; height: 16px; flex: 0 0 16px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.85; }
      .item .label { flex: 1 1 auto; }
      .item .hint { font-size: 11px; opacity: 0.55; }
      .item .chevron { width: 12px; height: 12px; opacity: 0.55; }
      .separator { height: 1px; margin: 5px 4px; background: ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}; }
      .section-title {
        padding: 4px 9px 6px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        opacity: 0.55;
        white-space: nowrap;
      }
      .ai {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
        padding: 5px 12px 5px 6px;
        border: 1px solid ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'};
        border-radius: 999px;
        background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.66)'};
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        outline: none;
        transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
      }
      .ai:hover, .ai:focus-visible {
        background: ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'};
        border-color: ${dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)'};
      }
      .ai:active { transform: scale(0.985); }
      .ai .badge {
        width: 22px; height: 22px; flex: 0 0 22px;
        display: inline-flex; align-items: center; justify-content: center;
        border-radius: 999px;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .ai .name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ai .go { width: 12px; height: 12px; opacity: 0.45; }
      .empty { padding: 6px 10px 8px; font-size: 12px; opacity: 0.6; white-space: nowrap; }
    `;
    root.appendChild(style);

    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');

    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    submenu.setAttribute('role', 'menu');

    const svg = (path) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      element.setAttribute('viewBox', '0 0 24 24');
      element.setAttribute('fill', 'none');
      element.setAttribute('stroke', 'currentColor');
      element.setAttribute('stroke-width', '2');
      element.setAttribute('stroke-linecap', 'round');
      element.setAttribute('stroke-linejoin', 'round');
      element.classList.add('glyph');
      const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      shape.setAttribute('d', path);
      element.appendChild(shape);
      return element;
    };

    const item = (iconPath, label, onClick, hint) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'item';
      button.setAttribute('role', 'menuitem');
      button.appendChild(svg(iconPath));
      const caption = document.createElement('span');
      caption.className = 'label';
      caption.textContent = label;
      button.appendChild(caption);
      if (hint) {
        const extra = document.createElement('span');
        extra.className = 'hint';
        extra.textContent = hint;
        button.appendChild(extra);
      }
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
        try { onClick(); } catch (_) {}
      });
      return button;
    };

    let selection = '';

    if (actions.length > 0) {
      const title = document.createElement('div');
      title.className = 'section-title';
      title.textContent = text.switchAi;
      submenu.appendChild(title);
      for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ai';
        button.setAttribute('role', 'menuitem');
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = Array.from(action.name.trim())[0] || '?';
        badge.style.background = actionColor(action.id);
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = action.name;
        const go = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        go.setAttribute('viewBox', '0 0 24 24');
        go.setAttribute('fill', 'none');
        go.setAttribute('stroke', 'currentColor');
        go.setAttribute('stroke-width', '2');
        go.setAttribute('stroke-linecap', 'round');
        go.setAttribute('stroke-linejoin', 'round');
        go.classList.add('go');
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', 'M9 6l6 6-6 6');
        go.appendChild(arrow);
        button.append(badge, name, go);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const target = options.switchPrefix + encodeURIComponent(action.id);
          close();
          window.location.href = target;
        });
        submenu.appendChild(button);
      }
    }

    root.append(menu, submenu);
    // Initialization scripts run at document start; the root element may still be missing.
    if (document.documentElement) {
      document.documentElement.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.documentElement.appendChild(host), { once: true });
    }

    const hide = () => {
      host.style.display = 'none';
      submenu.classList.remove('open');
    };

    const openSubmenu = () => {
      if (!actions.length) return;
      submenu.classList.add('open');
      place(submenu, menu.getBoundingClientRect().right - 4, menu.getBoundingClientRect().top, true);
    };

    const closeSubmenu = () => submenu.classList.remove('open');

    let hoverTimer = 0;
    let closeTimer = 0;

    const place = (element, x, y, preferRight) => {
      element.style.left = '0px';
      element.style.top = '0px';
      const bounds = element.getBoundingClientRect();
      const margin = 8;
      let left = preferRight ? x : x - bounds.width;
      let top = y;
      if (left + bounds.width > window.innerWidth - margin) left = window.innerWidth - bounds.width - margin;
      if (left < margin) left = margin;
      if (top + bounds.height > window.innerHeight - margin) top = window.innerHeight - bounds.height - margin;
      if (top < margin) top = margin;
      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
    };

    const copyText = (value) => {
      const fallback = () => {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy'); } catch (_) {}
        area.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).catch(fallback);
      } else {
        fallback();
      }
    };

    const open = (x, y, selectedText) => {
      selection = (selectedText || '').trim();
      menu.replaceChildren();
      if (selection) {
        menu.appendChild(item('M8 4h9a2 2 0 0 1 2 2v9M6 8h9a2 2 0 0 1 2 2v9H8a2 2 0 0 1-2-2V8z', text.copy, () => copyText(selection)));
      }
      menu.appendChild(item('M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6', text.reload, () => window.location.reload()));
      if (actions.length) {
        const separator = document.createElement('div');
        separator.className = 'separator';
        menu.appendChild(separator);
        const switchRow = document.createElement('button');
        switchRow.type = 'button';
        switchRow.className = 'item';
        switchRow.setAttribute('role', 'menuitem');
        switchRow.setAttribute('aria-haspopup', 'menu');
        switchRow.appendChild(svg('M4 7h11l-3-3M20 17H9l3 3'));
        const switchLabel = document.createElement('span');
        switchLabel.className = 'label';
        switchLabel.textContent = text.switchAi;
        switchRow.appendChild(switchLabel);
        switchRow.appendChild(svg('M9 6l6 6-6 6'));
        switchRow.addEventListener('mouseenter', () => {
          window.clearTimeout(hoverTimer);
          hoverTimer = window.setTimeout(openSubmenu, 110);
        });
        switchRow.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (submenu.classList.contains('open')) closeSubmenu();
          else openSubmenu();
        });
        menu.appendChild(switchRow);
      }
      host.style.display = 'block';
      place(menu, x, y, true);
    };

    const onContextMenu = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], video, audio')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(hoverTimer);
      closeSubmenu();
      open(event.clientX, event.clientY, window.getSelection ? String(window.getSelection()) : '');
    };

    const close = () => {
      window.clearTimeout(hoverTimer);
      window.clearTimeout(closeTimer);
      closeSubmenu();
      hide();
    };

    const onPointerDown = (event) => {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      if (!path.includes(host)) close();
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    const onHoverOut = (event) => {
      if (!host.contains(event.relatedTarget)) {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(closeSubmenu, 180);
      }
    };

    const onHoverIn = () => window.clearTimeout(closeTimer);

    menu.addEventListener('mouseleave', onHoverOut);
    submenu.addEventListener('mouseleave', onHoverOut);
    menu.addEventListener('mouseenter', onHoverIn);
    submenu.addEventListener('mouseenter', onHoverIn);

    document.addEventListener('contextmenu', onContextMenu, true);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', close, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('blur', close);

    const dispose = () => {
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', close, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('blur', close);
      host.remove();
      if (window.__ioxContextMenuDispose === dispose) delete window.__ioxContextMenuDispose;
      return true;
    };
    window.__ioxContextMenuDispose = dispose;
    return true;
  } catch (_) {
    return false;
  }
}

/** 稳定的胶囊徽标底色，只用于区分站点，不依赖站点图标资源。 */
function actionColor(id) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  const palette = ['#2563eb', '#7c3aed', '#0d9488', '#db2777', '#ea580c', '#0891b2', '#65a30d', '#9333ea'];
  return palette[hash % palette.length];
}
