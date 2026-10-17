// Executed only in an IOX-owned background WebView. No network calls or privileged IPC.
(() => {
  try {
    const state = window.__ioxHistoryCollector ||= { entries: new Map(), ticks: 0, stable: 0, lastSize: 0 };
    state.ticks++;
    const visible = el => el instanceof HTMLElement && el.getClientRects().length > 0;
    const rowSelector = 'a,li,[role="listitem"],[data-conversation-id],[data-session-id],[data-href],[data-url],[class~="chat-item"],[class~="conversation-item"],[data-testid="chat_list_item"]';
    const text = el => (el?.innerText || el?.textContent || '').trim();
    const day = value => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d; };
    const bounds = (from, to, precision, label) => ({ dateStart: Math.floor(from.getTime() / 1000), dateEnd: Math.floor(to.getTime() / 1000), precision, dateLabel: label });
    const dateInfo = value => {
      const label = String(value || '').trim();
      const today = day(Date.now());
      const end = offset => { const d = new Date(today); d.setDate(d.getDate() + offset + 1); d.setMilliseconds(-1); return d; };
      const start = offset => { const d = new Date(today); d.setDate(d.getDate() + offset); return d; };
      if (/^(今天|今日|today)$/i.test(label)) return bounds(today, end(0), 'day', label);
      if (/^(昨天|昨日|yesterday)$/i.test(label)) return bounds(start(-1), end(-1), 'day', label);
      if (/^(前天)$/i.test(label)) return bounds(start(-2), end(-2), 'day', label);
      const days = label.match(/^(?:过去|最近|近)\s*(7|30)\s*天$|^(?:previous|last|past)\s+(7|30)\s+days$/i);
      if (days) return bounds(start(-Number(days[1] || days[2]) + 1), end(0), 'range', label);
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const englishMonth = label.match(/^([a-z]+)(?:\s+(\d{4}))?$/i);
      const chineseMonth = label.match(/^(?:(\d{4})年)?(\d{1,2})月$/);
      const month = englishMonth ? monthNames.indexOf(englishMonth[1].toLowerCase()) : chineseMonth ? Number(chineseMonth[2]) - 1 : -1;
      if (month >= 0 && month < 12) {
        const explicitYear = englishMonth?.[2] || chineseMonth?.[1];
        const year = explicitYear ? Number(explicitYear) : today.getFullYear() - (month > today.getMonth() ? 1 : 0);
        return bounds(new Date(year, month, 1), new Date(year, month + 1, 1, 0, 0, 0, -1), 'range', label);
      }
      // Parse explicit dates only; never interpret arbitrary conversation titles as dates.
      if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s].*)?$/.test(label) || /^\d{4}年\d{1,2}月\d{1,2}日$/.test(label)) {
        const parsed = new Date(label.replace('年', '-').replace('月', '-').replace('日', ''));
        if (Number.isFinite(parsed.getTime())) {
          if (/[T\s]\d{1,2}:/.test(label)) return bounds(parsed, parsed, 'exact', label);
          const first = day(parsed); const last = new Date(first); last.setDate(last.getDate() + 1); last.setMilliseconds(-1);
          return bounds(first, last, 'day', label);
        }
      }
      if (/^\d{10}(?:\d{3})?$/.test(label)) {
        const parsed = new Date(Number(label) * (label.length === 10 ? 1000 : 1));
        if (parsed.getFullYear() >= 2000 && parsed.getTime() <= Date.now() + 86400000) return bounds(parsed, parsed, 'exact', '');
      }
      return null;
    };

    const canonical = raw => {
      if (!raw) return null;
      try {
        const url = new URL(raw, location.href);
        if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
        const path = url.hash.startsWith('#/') ? url.hash.slice(1).split('?')[0] : url.pathname;
        const match = path.match(/\/(?:a\/chat\/s|c|chat|conversation|conversations|session|app)\/([^/?#]+)\/?$/);
        const queryId = ['conversation_id', 'conversationId', 'sessionId', 'chatId'].find(key => url.searchParams.get(key));
        if (!match && !queryId) return null;
        if (match && /^(new|create|history|login|settings|all)$/i.test(match[1])) return null;
        if (match && !url.hash.startsWith('#/')) { url.search = ''; url.hash = ''; }
        for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_')) url.searchParams.delete(key);
        return url.href;
      } catch { return null; }
    };
    const rowUrl = el => {
      const explicit = el.getAttribute('href') || el.getAttribute('data-href') || el.getAttribute('data-url');
      if (explicit) return canonical(explicit);
      const id = el.getAttribute('data-conversation-id') || el.getAttribute('data-session-id');
      if (!id || /^(new|create)$/i.test(id)) return null;
      const routes = {
        'chat.deepseek.com': '/a/chat/s/', 'chatgpt.com': '/c/', 'chat.openai.com': '/c/',
        'claude.ai': '/chat/', 'kimi.com': '/chat/', 'www.kimi.com': '/chat/',
        'www.doubao.com': '/chat/', 'doubao.com': '/chat/', 'chat.qwen.ai': '/c/',
      };
      return routes[location.hostname] ? canonical(routes[location.hostname] + encodeURIComponent(id)) : null;
    };

    const roots = [...document.querySelectorAll('aside, nav, [role="navigation"], [data-testid*="sidebar"], [class*="sidebar"], [class*="Sidebar"], [class*="sider"], [class*="conversation-list"], [class*="chat-list"], [class*="chat-history"], [class*="history-list"]')]
      .filter(el => visible(el) && !el.closest('main, [role="main"]'));
    const containers = roots.filter(root => !roots.some(other => other !== root && other.contains(root)));
    for (const root of containers) {
      let groupDate = null;
      // Traversal in DOM order preserves the platform's order within imprecise date groups.
      for (const el of root.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"],div,span,p,li,a,[data-conversation-id],[data-session-id],[data-href],[data-url]')) {
        if (!visible(el)) continue;
        const label = text(el);
        // A title named "Today" is not a group heading.
        if (!el.closest(rowSelector) && !el.querySelector(rowSelector) && label.length < 45) {
          const parsed = dateInfo(label);
          if (parsed) groupDate = parsed;
          else if (/^H[1-6]$/.test(el.tagName) || el.getAttribute('role') === 'heading'
            || /group[-_]?(?:title|label)|date[-_]?(?:label|heading)|history[-_]?(?:group|date)/i.test(el.className || '')
            || /^(更早|较早|以前|older|earlier|previous months)$/i.test(label)) {
            groupDate = { dateStart: null, dateEnd: null, precision: 'unknown', dateLabel: label };
          }
        }
        if (el.tagName !== 'A' && !el.matches('[data-conversation-id],[data-session-id],[data-href],[data-url]')) continue;
        if (el.tagName !== 'A' && el.querySelector('a')) continue;
        const url = rowUrl(el);
        if (!url) continue;
        const row = el.closest('li,[role="listitem"],[data-testid*="history-item"]') || el;
        const title = (el.getAttribute('title') || el.getAttribute('aria-label') || text(el)).trim().slice(0, 300);
        if (!title) continue;
        const time = row.querySelector('time[datetime]');
        const rawDate = row.getAttribute('data-updated-at') || el.getAttribute('data-updated-at')
          || row.getAttribute('data-timestamp') || time?.getAttribute('datetime');
        const date = dateInfo(rawDate) || groupDate || { dateStart: null, dateEnd: null, precision: 'unknown', dateLabel: '' };
        const previous = state.entries.get(url);
        const stableDate = date.precision === 'unknown' && previous && previous.precision !== 'unknown'
          ? { dateStart: previous.dateStart, dateEnd: previous.dateEnd, precision: previous.precision, dateLabel: previous.dateLabel } : date;
        state.entries.set(url, { url, title, ...stableDate, sourceOrder: previous?.sourceOrder ?? state.entries.size });
      }
    }

    const login = [...document.querySelectorAll('a,button')].some(el => visible(el) && /^(log in|sign in|登录|登入|立即登录)$/i.test(text(el)))
      || /\/(?:login|sign_in|signin)(?:\/|$)/.test(location.pathname);
    const result = status => ({ origin: location.origin, status, entries: [...state.entries.values()] });
    if (login && !state.entries.size && state.ticks > 3) return result('login_required');

    // Only controls in a hidden, dedicated history page are touched.
    if (!containers.length && state.ticks < 6) {
      const toggle = [...document.querySelectorAll('button')].find(el => visible(el)
        && /^(open sidebar|expand sidebar|打开侧边栏|展开侧边栏)$/i.test(el.getAttribute('aria-label') || el.getAttribute('title') || text(el)));
      toggle?.click();
    }
    let scrolling = false;
    let loading = false;
    let explicitEnd = false;
    for (const root of containers) {
      loading ||= [...root.querySelectorAll('[aria-busy="true"],[role="progressbar"],[data-loading="true"]')].some(visible);
      explicitEnd ||= root.getAttribute('data-has-more') === 'false'
        || [...root.querySelectorAll('[data-has-more="false"]')].some(el => visible(el) && !el.closest(rowSelector))
        || [...root.querySelectorAll('p,span,div,footer,[role="status"]')].some(el => visible(el)
          && !el.children.length && !el.closest(rowSelector)
          && /^(?:没有更多(?:了|会话|历史)|no more (?:conversations|chats|history)|all (?:conversations|chats) loaded)[.!。]?$/i.test(text(el)));
      const scrollables = [root, ...root.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 8
        && el.clientHeight > 60 && /(auto|scroll)/.test(getComputedStyle(el).overflowY));
      for (const scroller of scrollables) {
        if (scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 4) {
          scroller.scrollTop += Math.max(100, scroller.clientHeight * 0.8);
          scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          scrolling = true;
        }
      }
      const more = [...root.querySelectorAll('button')].find(el => visible(el) && !el.disabled
        && /^(load more|show more|加载更多|更多历史|显示更多)$/i.test(text(el)));
      if (more) { more.click(); scrolling = true; }
    }
    const size = state.entries.size;
    state.stable = size === state.lastSize && !scrolling && !loading ? state.stable + 1 : 0;
    state.lastSize = size;
    if (size >= 2000 || state.ticks >= 60) return result(size ? 'partial' : 'unavailable');
    if (size && state.stable >= 3 && explicitEnd) return result('ready');
    // A quiet viewport alone cannot prove that the remote history is complete.
    if (size && state.stable >= 15) return result('partial');
    if (!size && state.ticks >= 12) {
      const empty = containers.some(el => /暂无(?:历史|会话|聊天)|no (?:conversations|chat history)|your chats will appear/i.test(text(el)));
      return result(empty ? 'empty' : 'unavailable');
    }
    return result('collecting');
  } catch (error) {
    return { origin: location.origin, status: 'error', entries: [], error: String(error) };
  }
})()
