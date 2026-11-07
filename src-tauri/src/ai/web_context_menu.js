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
      ? {
          copy: '复制选中内容',
          copyLink: '复制链接地址',
          reload: '刷新页面',
          switchAi: '切换 AI',
          askWithSelection: '带选中内容提问',
          switchOnlyTip: '右键仅切换窗口',
        }
      : {
          copy: 'Copy selection',
          copyLink: 'Copy link address',
          reload: 'Reload page',
          switchAi: 'Switch AI',
          askWithSelection: 'Ask with selection',
          switchOnlyTip: 'Right-click to switch only',
        };
    const actions = Array.isArray(options.actions) ? options.actions.filter((item) => item && item.id && item.name) : [];
    const resolveDark = () => options.theme === 'dark'
      || (options.theme !== 'light'
        && window.matchMedia
        && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const host = document.createElement('div');
    host.id = '__iox_context_menu_host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:none;';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');

    const applyThemeStyle = () => {
      const dark = resolveDark();
      style.textContent = `
        :host { all: initial; }
        .menu, .submenu {
          box-sizing: border-box;
          position: fixed;
          min-width: 204px;
          padding: 6px;
          border-radius: 14px;
          font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          color: ${dark ? '#f4f4f5' : '#27272a'};
          background: ${dark ? 'rgba(24,24,27,0.92)' : 'rgba(255,255,255,0.94)'};
          border: 1px solid ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)'};
          box-shadow: 0 18px 48px rgba(0,0,0,${dark ? '0.48' : '0.16'}), 0 2px 8px rgba(0,0,0,${dark ? '0.28' : '0.06'});
          backdrop-filter: blur(24px) saturate(160%);
          -webkit-backdrop-filter: blur(24px) saturate(160%);
          pointer-events: auto;
          user-select: none;
          overflow-x: hidden;
          overflow-y: auto;
          max-height: min(72vh, 520px);
          animation: iox-menu-in 120ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .submenu {
          display: none;
          min-width: 188px;
          max-width: 300px;
          padding: 8px;
          border-radius: 16px;
        }
        .submenu.open { display: flex; flex-direction: column; gap: 6px; }
        .capsule-track {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 5px;
          padding: 3px;
          border-radius: 14px;
          background: ${dark ? 'rgba(9,9,11,0.45)' : 'rgba(244,244,245,0.75)'};
          border: 1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'};
        }
        @keyframes iox-menu-in {
          from { opacity: 0; transform: scale(0.96) translateY(-2px); }
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
          transition: background 100ms ease;
        }
        .item:hover, .item:focus-visible, .item.active {
          background: ${dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.055)'};
        }
        .item:disabled { opacity: 0.5; cursor: default; }
        .item .glyph { width: 15px; height: 15px; flex: 0 0 15px; display: inline-flex; align-items: center; justify-content: center; opacity: 0.85; }
        .item .label { flex: 1 1 auto; }
        .item .hint { font-size: 11px; opacity: 0.55; }
        .separator { height: 1px; margin: 5px 4px; background: ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}; }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 2px 6px 2px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.02em;
          opacity: 0.58;
          white-space: nowrap;
        }
        .ai {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          max-width: 100%;
          box-sizing: border-box;
          padding: 0 10px 0 6px;
          border: 1px solid ${dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)'};
          border-radius: 999px;
          background: ${dark ? 'rgba(39,39,42,0.85)' : 'rgba(255,255,255,0.92)'};
          color: inherit;
          font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
          text-align: left;
          cursor: pointer;
          outline: none;
          box-shadow: 0 1px 2px rgba(0,0,0,${dark ? '0.25' : '0.04'});
          transition: background 150ms cubic-bezier(0.16, 1, 0.3, 1), border-color 150ms ease, transform 150ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 150ms ease;
        }
        .ai:hover, .ai:focus-visible {
          background: ${dark ? 'rgba(63,63,70,0.95)' : '#ffffff'};
          border-color: var(--ai-accent, ${dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.2)'});
          box-shadow: 0 2px 8px rgba(0,0,0,${dark ? '0.35' : '0.09'});
        }
        .ai:hover .badge, .ai:focus-visible .badge {
          transform: scale(1.08);
        }
        .ai:active { transform: scale(0.95); }
        .ai .badge {
          width: 18px; height: 18px; flex: 0 0 18px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: 999px;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          transition: transform 150ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ai .badge svg { width: 11px; height: 11px; }
        .ai .name {
          flex: 1 1 auto;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 160px;
        }
      `;
    };
    applyThemeStyle();
    root.appendChild(style);

    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');

    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    submenu.setAttribute('role', 'menu');
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'section-header';
    const sectionTitle = document.createElement('span');
    sectionTitle.textContent = text.switchAi;
    sectionHeader.appendChild(sectionTitle);
    const capsuleTrack = document.createElement('div');
    capsuleTrack.className = 'capsule-track';

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

    let hoverTimer = 0;
    let closeTimer = 0;
    let activeSwitchRow = null;
    let selection = '';

    const closeSubmenu = () => {
      submenu.classList.remove('open');
      if (activeSwitchRow) activeSwitchRow.classList.remove('active');
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
      button.addEventListener('mouseenter', () => {
        window.clearTimeout(hoverTimer);
        window.clearTimeout(closeTimer);
        closeSubmenu();
      });
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
        try { onClick(); } catch (_) {}
      });
      return button;
    };

    const triggerSwitch = (actionId, carrySelection) => {
      let target = options.switchPrefix + encodeURIComponent(actionId);
      if (carrySelection && selection) {
        target += '&text=' + encodeURIComponent(selection);
      }
      close();
      window.location.href = target;
    };

    if (actions.length > 0) {
      submenu.append(sectionHeader, capsuleTrack);
      for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ai';
        button.setAttribute('role', 'menuitem');
        const accent = brandColorFor(action.id, action.name, action.icon);
        button.style.setProperty('--ai-accent', accent);
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.style.background = accent;
        badge.textContent = brandInitialFor(action.id, action.name);
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = action.name;
        button.append(badge, name);
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          triggerSwitch(action.id, true);
        });
        button.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          event.stopPropagation();
          triggerSwitch(action.id, false);
        });
        capsuleTrack.appendChild(button);
      }
    }

    root.append(menu, submenu);
    if (document.documentElement) {
      document.documentElement.appendChild(host);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.documentElement.appendChild(host), { once: true });
    }

    const hide = () => {
      host.style.display = 'none';
      closeSubmenu();
    };

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

    const openSubmenu = () => {
      if (!actions.length) return;
      sectionTitle.textContent = selection ? text.askWithSelection : text.switchAi;
      submenu.classList.add('open');
      if (activeSwitchRow) activeSwitchRow.classList.add('active');
      submenu.style.left = '0px';
      submenu.style.top = '0px';
      const rect = menu.getBoundingClientRect();
      const rowRect = activeSwitchRow ? activeSwitchRow.getBoundingClientRect() : rect;
      const subBounds = submenu.getBoundingClientRect();
      const gap = 6;
      const margin = 8;
      const rightSpace = window.innerWidth - rect.right - gap - margin;
      const leftSpace = rect.left - gap - margin;
      // Keep the cascade outside the parent so it never covers the parent's items.
      if (rightSpace >= subBounds.width) {
        place(submenu, rect.right + gap, rowRect.top - 6, true);
      } else if (leftSpace >= subBounds.width) {
        place(submenu, rect.left - gap, rowRect.top - 6, false);
      } else {
        const belowSpace = window.innerHeight - rect.bottom - gap - margin;
        const topY = belowSpace >= subBounds.height || belowSpace >= rect.top - gap - margin
          ? rect.bottom + gap
          : Math.max(margin, rect.top - subBounds.height - gap);
        place(submenu, rect.left, topY, true);
      }
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

    const open = (x, y, selectedText, linkHref) => {
      applyThemeStyle();
      selection = (selectedText || '').trim();
      activeSwitchRow = null;
      menu.replaceChildren();
      if (selection) {
        menu.appendChild(item('M8 4h9a2 2 0 0 1 2 2v9M6 8h9a2 2 0 0 1 2 2v9H8a2 2 0 0 1-2-2V8z', text.copy, () => copyText(selection)));
      }
      if (linkHref) {
        menu.appendChild(item('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71', text.copyLink, () => copyText(linkHref)));
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
        switchLabel.textContent = selection ? text.askWithSelection : text.switchAi;
        switchRow.appendChild(switchLabel);
        switchRow.appendChild(svg('M9 6l6 6-6 6'));
        activeSwitchRow = switchRow;
        switchRow.addEventListener('mouseenter', () => {
          window.clearTimeout(hoverTimer);
          window.clearTimeout(closeTimer);
          hoverTimer = window.setTimeout(openSubmenu, 100);
        });
        switchRow.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          window.clearTimeout(hoverTimer);
          if (submenu.classList.contains('open')) closeSubmenu();
          else openSubmenu();
        });
        menu.appendChild(switchRow);
      }
      host.style.display = 'block';
      place(menu, x, y, true);
    };

    const onContextMenu = (event) => {
      if (event.shiftKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="searchbox"], video, audio, img, canvas')) {
        return;
      }
      let linkHref = '';
      const anchor = target.closest('a[href]');
      if (anchor && anchor.href && /^https?:/i.test(anchor.href)) {
        linkHref = anchor.href;
      }
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(hoverTimer);
      closeSubmenu();
      open(event.clientX, event.clientY, window.getSelection ? String(window.getSelection()) : '', linkHref);
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

    const withinPanels = (node) => Boolean(node) && (menu.contains(node) || submenu.contains(node));

    const onHoverOut = (event) => {
      if (withinPanels(event.relatedTarget)) return;
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(closeSubmenu, 180);
    };

    menu.addEventListener('mouseleave', onHoverOut);
    submenu.addEventListener('mouseleave', onHoverOut);
    menu.addEventListener('mouseenter', () => window.clearTimeout(closeTimer));
    submenu.addEventListener('mouseenter', () => window.clearTimeout(closeTimer));

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

/** 匹配内置 AI 品牌主色调，未命中时回退至稳定色板。 */
function brandColorFor(id, name, icon) {
  const key = `${id || ''} ${name || ''} ${icon || ''}`.toLowerCase();
  if (key.includes('deepseek') || key.includes('深度求索')) return '#4D6BFE';
  if (key.includes('chatgpt') || key.includes('openai')) return '#10A37F';
  if (key.includes('claude') || key.includes('anthropic')) return '#D97757';
  if (key.includes('kimi') || key.includes('moonshot')) return '#1783FF';
  if (key.includes('qwen') || key.includes('tongyi') || key.includes('千问') || key.includes('通义')) return '#615CED';
  if (key.includes('doubao') || key.includes('豆包')) return '#1E37FC';
  if (key.includes('gemini') || key.includes('google')) return '#3186FF';
  if (key.includes('grok') || key.includes('xai')) return '#27272A';
  if (key.includes('perplexity')) return '#22B8CF';
  if (key.includes('metaso') || key.includes('秘塔')) return '#6366F1';
  if (key.includes('xiaomi') || key.includes('mimo') || key.includes('小米')) return '#FF6900';
  if (key.includes('zhipu') || key.includes('glm') || key.includes('智谱')) return '#3859FF';
  if (key.includes('minimax')) return '#F23F5D';
  if (key.includes('wenxin') || key.includes('文心')) return '#2932E1';
  if (key.includes('hunyuan') || key.includes('混元') || key.includes('yuanbao') || key.includes('元宝')) return '#0052D9';
  let hash = 0;
  const seed = String(id || name || '');
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  const palette = ['#2563eb', '#0891b2', '#059669', '#7c3aed', '#db2777', '#ea580c', '#4f46e5'];
  return palette[hash % palette.length];
}

function brandInitialFor(id, name) {
  const key = `${id || ''} ${name || ''}`.toLowerCase();
  if (key.includes('deepseek')) return 'D';
  if (key.includes('chatgpt') || key.includes('openai')) return 'G';
  if (key.includes('claude')) return 'C';
  if (key.includes('kimi')) return 'K';
  if (key.includes('qwen') || key.includes('千问') || key.includes('通义')) return 'Q';
  if (key.includes('gemini')) return 'G';
  if (key.includes('perplexity')) return 'P';
  if (key.includes('grok')) return 'X';
  return Array.from((name || '').trim())[0] || '?';
}
