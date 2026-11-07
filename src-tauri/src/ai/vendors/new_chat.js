function clickNewChat(options) {
  try {
    if (window.top !== window || location.origin !== options.origin) {
      return { ok: false, reason: 'source_changed' };
    }

    const clickable = 'button,a[href],[role="button"],[tabindex]:not([tabindex="-1"]),.ds-icon-button,.ds-button';
    const message = 'article,[data-message-id],[data-message-author-role],[data-testid^="conversation-turn"],[data-testid^="message-"],.message,.chat-message,.ds-message,.markdown,.markdown-body';
    const editable = 'input,textarea,select,[role="textbox"],[role="searchbox"],[contenteditable]:not([contenteditable="false"])';
    const labels = new Set([
      '新对话', '新会话', '新聊天', '新建对话', '新建会话', '新建聊天',
      '新线程', '新建线程', '开启新对话', '开启新会话', '开启新线程',
      '开始新对话', '开始新会话', '创建新对话', '发起新对话', '发起对话',
      '开始对话', '新提问', 'new chat', 'new conversation',
      'new thread', 'start new chat', 'start a new chat', 'start new conversation',
      'start a new conversation', 'create new chat', 'new ask',
    ]);
    const isLabel = (text) => labels.has((text || '')
      .replace(/\s+/g, ' ').trim().toLowerCase()
      .replace(/\s*[(（]?\s*(?:ctrl|control|cmd|command|shift|alt|⌘|⇧|⌥)[\s\S]*$/i, '').trim());

    function usable(element) {
      if (!(element instanceof HTMLElement) || !element.isConnected || typeof element.click !== 'function') return false;
      if (element.closest(`${message},${editable},[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"],fieldset[disabled]`) || element.matches(':disabled')) return false;
      const anchor = element.closest('a[href]');
      if (anchor) {
        let url;
        try {
          url = new URL(anchor.href, location.href);
        } catch (_) {
          return false;
        }
        const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
        const isJs = url.protocol === 'javascript:';
        if ((!isHttp && !isJs) || (isHttp && url.origin !== location.origin)) return false;
        if (isHttp) {
          // A history item can itself be titled "New chat".
          const historyPath = /\/(?:c|chat|conversation|session|a\/chat\/s|thread)\/(?!new(?:\/|$))[^/]+/i;
          let fragmentPath = '';
          let fragmentParams = [];
          const rawHash = url.hash ? url.hash.slice(1) : '';
          if (rawHash.startsWith('/') || rawHash.startsWith('!/') || rawHash.startsWith('?')) {
            try {
              const normalizedHash = rawHash.startsWith('!') ? rawHash.slice(1) : rawHash;
              const fragment = new URL(normalizedHash, location.origin);
              if (fragment.origin === location.origin) {
                fragmentPath = fragment.pathname;
                fragmentParams = [...fragment.searchParams];
              }
            } catch (_) {}
          }
          const historyId = [...url.searchParams, ...fragmentParams].some(([key, value]) =>
            /^(?:conversation|session|chat|thread)(?:_?id)?$/i.test(key) && value && !/^(?:new|create)$/i.test(value));
          if (historyPath.test(url.pathname) || (fragmentPath && historyPath.test(fragmentPath)) || historyId) return false;
        }
      }
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') return false;
      }
      const rect = element.getBoundingClientRect();
      const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
      const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
      if (right <= left || bottom <= top) return false;
      const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
      return !!hit && (
        element.contains(hit)
        || hit.contains(element)
        || (typeof hit.closest === 'function' && hit.closest(clickable) === element)
      );
    }

    function buttonFor(node, trusted = false) {
      const target = node.closest(clickable);
      if (target) return target;
      if (trusted) return node.querySelector(clickable) || node;
      let match = null;
      for (let current = node; current && current !== document.body; current = current.parentElement) {
        if (!isLabel(current.textContent)) break;
        if (getComputedStyle(current).cursor === 'pointer') match = current;
      }
      return match;
    }

    function click(node, trusted = false) {
      const target = buttonFor(node, trusted);
      if (!usable(target)) return false;
      target.click();
      return true;
    }

    // Keep site selectors together; generic recognition below also covers custom Web actions.
    const siteSelectors = {
      'chatgpt.com': ['[data-testid="create-new-chat-button"]', '[data-testid="new-chat-button"]', '[data-testid="sidebar-new-chat-button"]'],
      'chat.openai.com': ['[data-testid="create-new-chat-button"]'],
      'claude.ai': ['a[href="/new"]'],
      'gemini.google.com': ['[data-test-id="expanded-button"]', 'button[aria-label*="New chat" i]', 'button[aria-label*="发起新对话"]'],
      'www.perplexity.ai': ['[data-testid="sidebar-new-thread"]', 'button[aria-label*="New Thread" i]', 'button[aria-label*="新建线程"]'],
      'perplexity.ai': ['[data-testid="sidebar-new-thread"]', 'button[aria-label*="New Thread" i]', 'button[aria-label*="新建线程"]'],
      'grok.com': ['a[aria-label*="New chat" i]', 'button[aria-label*="New chat" i]', 'button[aria-label*="新对话"]'],
      'www.qianwen.com': ['[data-session-switch-target="new-chat"]'],
      'qianwen.com': ['[data-session-switch-target="new-chat"]'],
      'tongyi.aliyun.com': ['[data-session-switch-target="new-chat"]'],
      'tongyi.cn': ['[data-session-switch-target="new-chat"]'],
      'www.doubao.com': ['[data-testid="create_conversation_button"]'],
      'doubao.com': ['[data-testid="create_conversation_button"]'],
      'www.kimi.com': ['a[aria-label="新建会话"]', 'a[href^="/?chat_enter_method=new_chat"]'],
      'kimi.com': ['a[href^="/?chat_enter_method=new_chat"]'],
      'kimi.moonshot.cn': ['a[aria-label="新建会话"]'],
      'aistudio.xiaomimimo.com': ['[data-track-id="navbar_new_chat_btn"]', '[data-track-id="sidebar_new_chat_btn"]'],
      'yuanbao.tencent.com': ['.yb-new-chat-entry__item[role="button"]'],
      'yi.baichuan-ai.com': ['a[aria-label="新建对话"]'],
      'www.baichuan-ai.com': ['a[aria-label="新建对话"]'],
      'chatglm.cn': ['.new-session-btn', '[class*="new-session"]'],
      'yiyan.baidu.com': ['[class*="newChat"]', '[class*="new-session"]'],
      'metaso.cn': ['button[aria-label*="新对话"]', 'button[aria-label*="新建对话"]'],
    };
    for (const selector of siteSelectors[location.hostname] || []) {
      for (const node of document.querySelectorAll(selector)) {
        if (click(node, true)) return { ok: true };
      }
    }

    // DeepSeek uses the same new-chat glyph in both sidebar layouts. Its background
    // class is shared by unrelated buttons, so resolve the glyph's clickable owner.
    if (location.hostname === 'chat.deepseek.com') {
      for (const path of document.querySelectorAll('svg path[d]')) {
        const data = path.getAttribute('d') || '';
        if (data.startsWith('M8 0.599609') && data.includes('M7.34473 4.93945') && click(path)) {
          return { ok: true };
        }
      }
    }

    for (const node of document.querySelectorAll(`${clickable},[aria-label],[aria-labelledby],[title],[data-tooltip-content]`)) {
      const referenced = (node.getAttribute('aria-labelledby') || '').split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || '').join(' ');
      if ([node.getAttribute('aria-label'), referenced, node.getAttribute('title'), node.getAttribute('data-tooltip-content')].some(isLabel) && click(node)) {
        return { ok: true };
      }
    }
    for (const node of document.querySelectorAll(`${clickable},div,span`)) {
      if ((node.textContent || '').length < 100 && isLabel(node.textContent) && click(node)) {
        return { ok: true };
      }
    }
    return { ok: false, reason: 'not_found' };
  } catch (_) {
    return { ok: false, reason: 'click_failed' };
  }
}
