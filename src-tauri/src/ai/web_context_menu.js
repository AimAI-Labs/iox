/**
 * IOX Web 卡片自定义右键菜单。
 *
 * 通过初始化脚本注入到官网页面，使用 closed shadow root 隔离站点样式。
 * 只接管页面空白区域的右键：输入框、可编辑区域与媒体元素保留浏览器原生菜单，
 * 因此粘贴、拼写检查等能力不会丢失。切换 AI 通过固定的哨兵 URL 交给 Rust 处理，
 * 页面本身不会获得任何 Tauri IPC 权限。级联项复用划词胶囊条的 iconOnly 形态、
 * ActionConfig.icon 契约与 config.actions 顺序；因运行在第三方页面的 closed shadow root，
 * 无法直接复用 BubbleBar / DynamicIcon 等 React 组件或应用主题 token，故品牌 SVG 由
 * web_context_menu_icons.js（scripts/generate-web-context-menu-icons.mjs 生成）随脚本注入。
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
    // 顺序与划词胶囊条同源：Rust 按 config.actions 顺序传入（只过滤非 Web / 禁用 / 当前动作），
    // 此处不排序、不重排，级联胶囊按同一相对次序从左到右依次展开。
    const actions = Array.isArray(options.actions) ? options.actions.filter((item) => item && item.id && item.name) : [];
    const resolveDark = () => options.theme === 'dark'
      || (options.theme !== 'light'
        && window.matchMedia
        && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const host = document.createElement('div');
    host.id = '__iox_context_menu_host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:none;';
    const root = host.attachShadow({ mode: 'closed' });
    // 静态样式只写入一次；主题切换时仅替换 :host 上的颜色变量。
    const style = document.createElement('style');
    const themeStyle = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        --iox-radius: 14px;
        --iox-ease: cubic-bezier(0.23, 1, 0.32, 1);
        --iox-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      .menu, .submenu {
        box-sizing: border-box;
        position: fixed;
        min-width: 218px;
        padding: 6px;
        border-radius: var(--iox-radius);
        font: 12.5px/1.45 var(--iox-font);
        color: var(--iox-ink);
        background: var(--iox-panel);
        border: 1px solid var(--iox-line);
        box-shadow: var(--iox-shadow), inset 0 1px 0 var(--iox-highlight);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        pointer-events: auto;
        user-select: none;
        overflow-x: hidden;
        overflow-y: auto;
        max-height: min(72vh, 520px);
        scrollbar-width: thin;
        scrollbar-color: var(--iox-line-strong) transparent;
        animation: iox-menu-in 150ms var(--iox-ease);
        transform-origin: var(--iox-origin, top left);
      }
      .menu::-webkit-scrollbar, .submenu::-webkit-scrollbar { width: 6px; height: 6px; }
      .menu::-webkit-scrollbar-thumb, .submenu::-webkit-scrollbar-thumb { border-radius: 999px; background: var(--iox-line-strong); }
      .submenu {
        display: none;
        /* 只放图标时按内容收缩成一条紧凑胶囊条，动作多时再换行。 */
        min-width: 152px;
        max-width: min(320px, calc(100vw - 16px));
        max-height: min(64vh, 440px);
        padding: 9px;
      }
      .submenu.open { display: flex; flex-direction: column; gap: 8px; }
      @keyframes iox-menu-in {
        from { opacity: 0; transform: scale(0.965) translateY(-4px); }
        to { opacity: 1; transform: none; }
      }
      .item {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        box-sizing: border-box;
        min-height: 34px;
        padding: 6px 8px;
        border: 0;
        border-radius: 9px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        outline: none;
        white-space: nowrap;
        transition: background-color 120ms ease, color 120ms ease, transform 120ms var(--iox-ease);
      }
      .item:hover, .item:focus-visible, .item.active { background: var(--iox-hover); }
      .item:focus-visible { outline: 2px solid var(--iox-focus); outline-offset: -2px; }
      .item:active { transform: scale(0.985); }
      .item:disabled { opacity: 0.45; cursor: default; }
      .item .glyph { width: 16px; height: 16px; flex: 0 0 16px; display: inline-flex; align-items: center; justify-content: center; color: var(--iox-ink-2); }
      .item .label { flex: 1 1 auto; min-width: 0; }
      .item .hint { padding: 1px 5px; border: 1px solid var(--iox-line); border-radius: 5px; background: var(--iox-inset); font-size: 10px; line-height: 1.4; color: var(--iox-ink-3); }
      .item .chevron { width: 14px; height: 14px; flex: 0 0 14px; margin-left: 1px; opacity: 0.65; transition: transform 150ms var(--iox-ease); }
      .item.active .chevron { transform: rotate(90deg); }
      .separator { height: 1px; margin: 5px 7px; background: var(--iox-line); }
      .section-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 3px; }
      .section-title { font-size: 11px; font-weight: 650; letter-spacing: 0.02em; color: var(--iox-ink-2); white-space: nowrap; }
      .section-count { min-width: 18px; padding: 1px 6px; border-radius: 999px; background: var(--iox-inset); color: var(--iox-ink-3); font-size: 10px; line-height: 1.4; font-variant-numeric: tabular-nums; text-align: center; }
      /* 与划词胶囊条一致：按配置顺序从左到右排列，不重排、不按列填充。 */
      .ai-track { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
      /* 复用胶囊条的 iconOnly 形态：只显示品牌图标，动作名由 aria-label 承载。
         尺寸对齐无头胶囊条的固定动作按钮（28–30px 圆形、15px 图标、按压回弹）。 */
      .ai {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 30px;
        width: 30px;
        height: 30px;
        box-sizing: border-box;
        padding: 0;
        border: 1px solid var(--iox-line);
        border-radius: 999px;
        background: var(--iox-chip);
        color: var(--iox-ink);
        cursor: pointer;
        outline: none;
        transition: background-color 140ms var(--iox-ease), border-color 140ms ease, transform 140ms var(--iox-ease), box-shadow 140ms ease;
      }
      .ai:hover, .ai:focus-visible {
        background: var(--iox-chip-hover);
        border-color: var(--ai-accent, var(--iox-accent));
        box-shadow: 0 2px 10px var(--iox-shadow-soft);
        transform: translateY(-1px);
      }
      .ai:focus-visible { outline: 2px solid var(--iox-focus); outline-offset: -2px; }
      .ai:active { transform: scale(0.94); }
      .ai .icon-box { display: grid; place-items: center; width: 22px; height: 22px; flex: 0 0 22px; border-radius: 999px; background: var(--ai-tint, var(--iox-inset)); }
      .ai .icon-box svg { display: block; width: 15px; height: 15px; }
      /* 顺序与胶囊条一致：从左到右逐个展开，索引即传入动作的相对次序。 */
      .submenu.open .ai {
        animation: iox-ai-in 160ms var(--iox-ease) backwards;
        animation-delay: calc(var(--iox-index, 0) * 35ms);
      }
      @keyframes iox-ai-in {
        from { opacity: 0; transform: translateX(-6px) scale(0.96); }
        to { opacity: 1; transform: none; }
      }
      .submenu-footer { padding: 1px 3px 0; font-size: 10.5px; line-height: 1.35; color: var(--iox-ink-3); }
      @media (prefers-reduced-motion: reduce) {
        .menu, .submenu, .submenu.open .ai { animation: none; }
        .item, .ai, .item .chevron { transition: none; }
        .ai:hover, .ai:focus-visible, .item:active, .ai:active { transform: none; }
      }
      @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
        .menu, .submenu { background: var(--iox-panel-solid); border-color: var(--iox-line-strong); backdrop-filter: none; -webkit-backdrop-filter: none; }
      }
    `;

    const applyThemeStyle = () => {
      themeStyle.textContent = resolveDark()
        ? `:host {
            --iox-panel: rgba(24, 25, 29, 0.94);
            --iox-panel-solid: #1b1d22;
            --iox-ink: #f2f3f5;
            --iox-ink-2: #a8acb5;
            --iox-ink-3: #7b808a;
            --iox-line: rgba(255, 255, 255, 0.10);
            --iox-line-strong: rgba(255, 255, 255, 0.22);
            --iox-hover: rgba(255, 255, 255, 0.075);
            --iox-inset: rgba(255, 255, 255, 0.06);
            --iox-chip: rgba(255, 255, 255, 0.045);
            --iox-chip-hover: rgba(255, 255, 255, 0.095);
            --iox-highlight: rgba(255, 255, 255, 0.055);
            --iox-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
            --iox-shadow-soft: rgba(0, 0, 0, 0.3);
            --iox-accent: #6aa6ff;
            --iox-focus: #529cff;
          }`
        : `:host {
            --iox-panel: rgba(255, 255, 255, 0.96);
            --iox-panel-solid: #ffffff;
            --iox-ink: #1f1e1c;
            --iox-ink-2: #57544e;
            --iox-ink-3: #8b877f;
            --iox-line: rgba(0, 0, 0, 0.09);
            --iox-line-strong: rgba(0, 0, 0, 0.18);
            --iox-hover: rgba(0, 0, 0, 0.055);
            --iox-inset: rgba(0, 0, 0, 0.045);
            --iox-chip: rgba(255, 255, 255, 0.86);
            --iox-chip-hover: #ffffff;
            --iox-highlight: rgba(255, 255, 255, 0.9);
            --iox-shadow: 0 16px 40px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.06);
            --iox-shadow-soft: rgba(0, 0, 0, 0.1);
            --iox-accent: #2563eb;
            --iox-focus: #2563eb;
          }`;
    };
    applyThemeStyle();
    root.append(style, themeStyle);

    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.setAttribute('role', 'menu');

    const submenu = document.createElement('div');
    submenu.className = 'submenu';
    submenu.setAttribute('role', 'menu');
    submenu.setAttribute('aria-label', text.switchAi);
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'section-header';
    const sectionTitle = document.createElement('span');
    sectionTitle.className = 'section-title';
    sectionTitle.textContent = text.switchAi;
    const sectionCount = document.createElement('span');
    sectionCount.className = 'section-count';
    sectionCount.textContent = String(actions.length);
    sectionHeader.append(sectionTitle, sectionCount);
    const aiTrack = document.createElement('div');
    aiTrack.className = 'ai-track';
    const submenuFooter = document.createElement('div');
    submenuFooter.className = 'submenu-footer';
    submenuFooter.textContent = text.switchOnlyTip;

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

    // 图标几何图形由 scripts.rs 拼接 web_context_menu_icons.js 注入，仅含 SVG 形状。
    const iconTable = typeof IOX_MENU_ICONS === 'undefined' ? {} : IOX_MENU_ICONS;
    const iconAliases = typeof IOX_MENU_ICON_ALIASES === 'undefined' ? {} : IOX_MENU_ICON_ALIASES;
    const iconKeywords = typeof IOX_MENU_ICON_KEYWORDS === 'undefined' ? [] : IOX_MENU_ICON_KEYWORDS;
    const fallbackIcon = {
      markup: '<path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7L12 3z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/>',
      mode: 'fill',
      color: null,
    };

    /** 按动作 icon key（或其别名、动作名 / id 中的品牌词）解析对应图标。 */
    const iconFor = (action) => {
      const key = String(action.icon || '');
      const canonical = iconAliases[key.toLowerCase()] || key;
      const direct = iconTable[canonical] || iconTable[key];
      if (direct) return direct;
      const haystack = `${action.id || ''} ${action.name || ''} ${key}`.toLowerCase();
      for (const [keyword, iconKey] of iconKeywords) {
        if (haystack.includes(keyword) && iconTable[iconKey]) return iconTable[iconKey];
      }
      return iconTable.Sparkles || fallbackIcon;
    };

    const tintFor = (color) => {
      const match = /^#([0-9a-f]{6})$/i.exec(color || '');
      if (!match) return null;
      const value = parseInt(match[1], 16);
      return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, 0.14)`;
    };

    const brandIcon = (action) => {
      const entry = iconFor(action);
      const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      element.setAttribute('viewBox', '0 0 24 24');
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('class', 'ai-glyph');
      if (entry.mode === 'stroke') {
        element.setAttribute('fill', 'none');
        element.setAttribute('stroke', 'currentColor');
        element.setAttribute('stroke-width', '2');
        element.setAttribute('stroke-linecap', 'round');
        element.setAttribute('stroke-linejoin', 'round');
      } else {
        element.setAttribute('fill', 'currentColor');
      }
      element.style.color = entry.color || 'var(--iox-accent)';
      // 只写入构建期生成的静态图形；动作名等配置值一律通过 textContent 写入。
      element.innerHTML = entry.markup;
      return { element, color: entry.color };
    };

    let hoverTimer = 0;
    let closeTimer = 0;
    let activeSwitchRow = null;
    let selection = '';

    const closeSubmenu = () => {
      submenu.classList.remove('open');
      if (activeSwitchRow) {
        activeSwitchRow.classList.remove('active');
        activeSwitchRow.setAttribute('aria-expanded', 'false');
      }
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
      submenu.append(sectionHeader, aiTrack, submenuFooter);
      for (const [index, action] of actions.entries()) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ai';
        button.setAttribute('role', 'menuitem');
        // 索引决定展开先后，顺序始终等于 Rust 传入的动作顺序。
        button.style.setProperty('--iox-index', String(index));
        const { element: glyph, color } = brandIcon(action);
        if (color) {
          button.style.setProperty('--ai-accent', color);
          const tint = tintFor(color);
          if (tint) button.style.setProperty('--ai-tint', tint);
        }
        const iconBox = document.createElement('span');
        iconBox.className = 'icon-box';
        iconBox.appendChild(glyph);
        button.appendChild(iconBox);
        // 复用胶囊条 iconOnly 语义：不渲染文字，名称只作为无障碍标签与调试标识。
        button.setAttribute('aria-label', action.name);
        button.setAttribute('data-action-id', action.id);
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
        aiTrack.appendChild(button);
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
      // 面板从触发点所在的角展开，向上翻转时改用下边缘作为动画原点。
      element.style.setProperty('--iox-origin', `${top < y ? 'bottom' : 'top'} ${preferRight ? 'left' : 'right'}`);
      element.style.left = `${Math.round(left)}px`;
      element.style.top = `${Math.round(top)}px`;
    };

    const openSubmenu = () => {
      if (!actions.length) return;
      sectionTitle.textContent = selection ? text.askWithSelection : text.switchAi;
      submenu.classList.add('open');
      if (activeSwitchRow) {
        activeSwitchRow.classList.add('active');
        activeSwitchRow.setAttribute('aria-expanded', 'true');
      }
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
        menu.appendChild(item('M8 4h9a2 2 0 0 1 2 2v9M6 8h9a2 2 0 0 1 2 2v9H8a2 2 0 0 1-2-2V8z', text.copy, () => copyText(selection), 'Ctrl+C'));
      }
      if (linkHref) {
        menu.appendChild(item('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71', text.copyLink, () => copyText(linkHref)));
      }
      menu.appendChild(item('M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6', text.reload, () => window.location.reload(), 'Ctrl+R'));
      if (actions.length) {
        const separator = document.createElement('div');
        separator.className = 'separator';
        menu.appendChild(separator);
        const switchRow = document.createElement('button');
        switchRow.type = 'button';
        switchRow.className = 'item';
        switchRow.setAttribute('role', 'menuitem');
        switchRow.setAttribute('aria-haspopup', 'menu');
        switchRow.setAttribute('aria-expanded', 'false');
        switchRow.appendChild(svg('M4 7h11l-3-3M20 17H9l3 3'));
        const switchLabel = document.createElement('span');
        switchLabel.className = 'label';
        switchLabel.textContent = selection ? text.askWithSelection : text.switchAi;
        switchRow.appendChild(switchLabel);
        const chevron = svg('M9 6l6 6-6 6');
        chevron.classList.add('chevron');
        switchRow.appendChild(chevron);
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
