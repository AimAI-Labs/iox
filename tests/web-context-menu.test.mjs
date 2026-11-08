import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const iconsSource = read('src-tauri/src/ai/web_context_menu_icons.js');
const menuSource = read('src-tauri/src/ai/web_context_menu.js');
const frontendIcons = read('src/components/Icons.tsx');
const SWITCH_PREFIX = 'https://iox.local/switch-ai?action=';

function frontendMapKeys(name) {
  const block = frontendIcons.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(block, `Icons.tsx 中缺少 ${name}`);
  return [...block[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*,?\s*$/gm)].map((match) => match[1]);
}

function iconTables() {
  const context = vm.createContext({});
  vm.runInContext(
    `${iconsSource}\nglobalThis.tables = { icons: IOX_MENU_ICONS, aliases: IOX_MENU_ICON_ALIASES, keywords: IOX_MENU_ICON_KEYWORDS };`,
    context,
  );
  return context.tables;
}

const SHAPE_TAGS = ['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon'];
const SHAPE_ATTRS = [
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'points', 'fill-rule', 'clip-rule', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
];

test('图标表覆盖前端图标 key，且只包含静态 SVG 几何图形', () => {
  const { icons, aliases, keywords } = iconTables();
  const keys = [...frontendMapKeys('AI_ICON_MAP'), ...frontendMapKeys('LUCIDE_ICON_MAP')];
  assert.ok(keys.length > 50);
  for (const key of keys) {
    const entry = icons[key];
    assert.ok(entry, `缺少图标 ${key}`);
    assert.ok(entry.markup.length > 0, `图标 ${key} 为空`);
    assert.ok(['fill', 'stroke'].includes(entry.mode), `图标 ${key} 模式无效`);
    assert.ok(entry.color === null || /^#[0-9A-F]{6}$/.test(entry.color), `图标 ${key} 颜色无效`);
    const shapes = [...entry.markup.matchAll(/<([a-z]+)\s+([^>]*?)\/>/g)];
    assert.equal(shapes.length, (entry.markup.match(/</g) || []).length, `图标 ${key} 含非形状标签`);
    for (const [, tag, attrs] of shapes) {
      assert.ok(SHAPE_TAGS.includes(tag), `图标 ${key} 含标签 ${tag}`);
      for (const attr of attrs.matchAll(/([a-z-]+)="[^"]*"/g)) {
        assert.ok(SHAPE_ATTRS.includes(attr[1]), `图标 ${key} 含属性 ${attr[1]}`);
      }
    }
  }
  for (const [alias, key] of Object.entries(aliases)) {
    assert.ok(icons[key], `别名 ${alias} 指向不存在的图标 ${key}`);
  }
  for (const [keyword, key] of keywords) {
    assert.ok(icons[key], `关键词 ${keyword} 指向不存在的图标 ${key}`);
  }
  assert.equal(aliases.chatgpt, 'OpenAI');
  assert.equal(aliases['千问'], 'Qwen');
  assert.equal(aliases['秘塔'], 'Metaso');
});

test('默认 Web 动作与自定义动作的图标都能解析', () => {
  const { icons } = iconTables();
  for (const key of [
    'DeepSeek', 'Kimi', 'Perplexity', 'Metaso', 'OpenAI', 'Qwen', 'Phind',
    'Felo', 'Ai360', 'Xiaomi', 'Languages', 'FileText', 'Copy', 'Globe',
    'Bot', 'Sparkles',
  ]) {
    assert.ok(icons[key], `缺少默认动作图标 ${key}`);
  }
});

class StubClassList {
  constructor(element) {
    this.element = element;
    this.names = new Set();
  }
  add(...names) {
    names.forEach((name) => this.names.add(name));
    this.sync();
  }
  remove(...names) {
    names.forEach((name) => this.names.delete(name));
    this.sync();
  }
  contains(name) {
    return this.names.has(name);
  }
  sync() {
    this.element._className = [...this.names].join(' ');
  }
}

class StubElement {
  constructor(tag) {
    this.tag = String(tag).toLowerCase();
    this.children = [];
    this.attributes = {};
    this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this._className = '';
    this.classList = new StubClassList(this);
    this.textContent = '';
    this.innerHTML = '';
    this.removed = false;
    this.parent = null;
  }
  get className() {
    return this._className;
  }
  set className(value) {
    this._className = value;
    this.classList.names = new Set(String(value).split(/\s+/).filter(Boolean));
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  appendChild(node) {
    node.parent = this;
    this.children.push(node);
    return node;
  }
  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }
  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((fn) => fn !== handler));
  }
  contains(node) {
    return node === this || this.children.some((child) => child.contains(node));
  }
  remove() {
    this.removed = true;
    if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
  }
  attachShadow() {
    this.shadowRoot = new StubElement('shadow-root');
    return this.shadowRoot;
  }
  closest(selector) {
    if (selector === 'a[href]') return this.tag === 'a' ? this : null;
    if (selector.includes('[contenteditable]')) {
      return ['input', 'textarea', 'select', 'video', 'audio', 'img', 'canvas'].includes(this.tag)
        ? this
        : null;
    }
    return null;
  }
  getBoundingClientRect() {
    return { width: 220, height: 120, left: 0, top: 0, right: 220, bottom: 120 };
  }
  dispatch(type, event = {}) {
    const payload = { ...event, defaultPrevented: false };
    payload.preventDefault = () => { payload.defaultPrevented = true; };
    payload.stopPropagation = () => {};
    for (const handler of this.listeners.get(type) || []) handler(payload);
    return payload;
  }
}

function dispatchOn(listeners, type, event) {
  const payload = { ...event, defaultPrevented: false };
  payload.preventDefault = () => { payload.defaultPrevented = true; };
  payload.stopPropagation = () => {};
  for (const handler of listeners.get(type) || []) handler(payload);
  return payload;
}

function createHarness(options = {}) {
  const docListeners = new Map();
  const winListeners = new Map();
  const copies = [];
  let navigation = '';
  let reloads = 0;
  let selectedText = 'Hello IOX';

  const document = {
    documentElement: new StubElement('html'),
    body: new StubElement('body'),
    createElement: (tag) => new StubElement(tag),
    createElementNS: (_ns, tag) => new StubElement(tag),
    addEventListener: (type, handler) => {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(handler);
    },
    removeEventListener: (type, handler) => {
      docListeners.set(type, (docListeners.get(type) || []).filter((fn) => fn !== handler));
    },
    dispatch: (type, event) => dispatchOn(docListeners, type, event),
    execCommand: () => true,
  };
  const location = {
    get href() { return navigation; },
    set href(value) { navigation = value; },
    reload() { reloads += 1; },
  };
  const windowStub = {
    innerWidth: 1200,
    innerHeight: 800,
    location,
    matchMedia: () => ({ matches: false }),
    setTimeout: () => 1,
    clearTimeout: () => {},
    getSelection: () => selectedText,
    addEventListener: (type, handler) => {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(handler);
    },
    removeEventListener: (type, handler) => {
      winListeners.set(type, (winListeners.get(type) || []).filter((fn) => fn !== handler));
    },
    dispatch: (type, event) => dispatchOn(winListeners, type, event),
  };
  windowStub.top = windowStub;
  const navigator = {
    clipboard: {
      writeText(value) {
        copies.push(value);
        return Promise.resolve();
      },
    },
  };
  const sandbox = {
    window: windowStub,
    document,
    navigator,
    Element: StubElement,
    console,
  };
  const payload = {
    theme: 'light',
    language: 'zh',
    switchPrefix: SWITCH_PREFIX,
    actions: [
      { id: 'act_web_b', name: 'DeepSeek', icon: 'DeepSeek' },
      { id: 'act_web_c', name: 'ChatGPT', icon: 'OpenAI' },
      { id: 'act_web_d', name: 'Kimi', icon: 'Kimi' },
    ],
    ...options,
  };
  const source = `(()=>{\n${iconsSource}\n${menuSource}\nreturn installIoxContextMenu(${JSON.stringify(payload)});})()\n`;
  const installed = vm.runInNewContext(source, sandbox);
  assert.equal(installed, true, '右键菜单注入失败');

  const host = document.documentElement.children.find((node) => node.id === '__iox_context_menu_host');
  assert.ok(host, '未创建 shadow host');
  const root = host.shadowRoot;
  const menu = root.children.find((node) => node.className === 'menu');
  const submenu = root.children.find((node) => node.className === 'submenu');
  const style = root.children.find((node) => node.tag === 'style');
  const themeStyle = root.children.filter((node) => node.tag === 'style')[1];
  assert.ok(menu && submenu && style && themeStyle);

  const openMenu = (overrides = {}) => {
    const target = overrides.target || new StubElement('div');
    return document.dispatch('contextmenu', {
      shiftKey: false,
      target,
      clientX: 100,
      clientY: 100,
      ...overrides,
    });
  };
  const items = () => menu.children.filter((node) => node.className === 'item');
  const labelOf = (item) => item.children.find((node) => node.className === 'label')?.textContent;
  const hintOf = (item) => item.children.find((node) => node.className === 'hint')?.textContent;
  const aiButtons = () => submenu.children
    .find((node) => node.className === 'ai-track')?.children || [];

  return {
    host, root, menu, submenu, style, themeStyle,
    windowStub, document, copies, openMenu, items, labelOf, hintOf, aiButtons,
    get navigation() { return navigation; },
    get reloads() { return reloads; },
    set selectedText(value) { selectedText = value; },
  };
}

test('右键菜单保留原有菜单项、快捷键提示与主题样式', () => {
  const h = createHarness();
  assert.match(h.style.textContent, /transform-origin: var\(--iox-origin/);
  assert.match(h.style.textContent, /prefers-reduced-motion/);
  assert.match(h.themeStyle.textContent, /--iox-panel:/);

  const anchor = new StubElement('a');
  anchor.href = 'https://example.com/page';
  const event = h.openMenu({ target: anchor });
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.host.style.display, 'block');

  const labels = h.items().map((item) => h.labelOf(item));
  assert.deepEqual(labels, ['复制选中内容', '复制链接地址', '刷新页面', '带选中内容提问']);
  assert.equal(h.hintOf(h.items()[0]), 'Ctrl+C');
  assert.equal(h.hintOf(h.items()[2]), 'Ctrl+R');
  assert.equal(h.menu.children.filter((node) => node.className === 'separator').length, 1);
  assert.equal(h.items().at(-1).getAttribute('aria-haspopup'), 'menu');

  h.items()[0].dispatch('click');
  assert.equal(h.copies.at(-1), 'Hello IOX');
  assert.equal(h.host.style.display, 'none');

  h.openMenu({ target: anchor });
  h.items()[1].dispatch('click');
  assert.equal(h.copies.at(-1), 'https://example.com/page');

  h.openMenu({ target: anchor });
  h.items()[2].dispatch('click');
  assert.equal(h.reloads, 1);

  h.openMenu();
  assert.equal(h.hintOf(h.items()[0]), 'Ctrl+C');
});

test('级联面板按动作 icon 渲染对应品牌图标，并保留两种切换行为', () => {
  const h = createHarness();
  const { icons } = iconTables();
  h.openMenu();
  const switchRow = h.items().at(-1);
  assert.equal(switchRow.getAttribute('aria-expanded'), 'false');
  switchRow.dispatch('click');
  assert.ok(h.submenu.classList.contains('open'));
  assert.equal(switchRow.getAttribute('aria-expanded'), 'true');

  const buttons = h.aiButtons();
  assert.equal(buttons.length, 3);
  assert.deepEqual(buttons.map((button) => button.getAttribute('aria-label')), ['DeepSeek', 'ChatGPT', 'Kimi']);
  assert.deepEqual(buttons.map((button) => button.getAttribute('data-action-id')), ['act_web_b', 'act_web_c', 'act_web_d']);
  assert.ok(buttons.every((button) => button.children.length === 1), '级联项不应渲染名称文本');
  assert.doesNotMatch(h.style.textContent, /\.ai \.name/);
  assert.deepEqual(buttons.map((button) => button.style['--iox-index']), ['0', '1', '2']);
  assert.match(h.style.textContent, /\.ai-track \{ display: flex; flex-wrap: wrap/);
  assert.match(h.style.textContent, /@keyframes iox-ai-in/);
  assert.match(h.style.textContent, /animation-delay: calc\(var\(--iox-index/);
  for (const [index, key] of ['DeepSeek', 'OpenAI', 'Kimi'].entries()) {
    const iconBox = buttons[index].children[0];
    assert.equal(iconBox.className, 'icon-box');
    const svg = iconBox.children[0];
    assert.equal(svg.attributes['aria-hidden'], 'true');
    assert.equal(svg.innerHTML, icons[key].markup, `${key} 未使用对应图标`);
  }
  assert.equal(buttons[0].style['--ai-accent'], icons.DeepSeek.color);
  assert.match(buttons[0].style['--ai-tint'], /^rgba\(/);
  assert.equal(
    h.submenu.children.find((node) => node.className === 'submenu-footer').textContent,
    '右键仅切换窗口',
  );

  buttons[0].dispatch('click');
  assert.equal(h.navigation, `${SWITCH_PREFIX}act_web_b&text=Hello%20IOX`);
  assert.equal(h.host.style.display, 'none');

  h.openMenu();
  h.items().at(-1).dispatch('click');
  h.aiButtons()[1].dispatch('contextmenu');
  assert.equal(h.navigation, `${SWITCH_PREFIX}act_web_c`);
});

test('Shift 右键、输入区域、Escape 与 dispose 仍保留原有行为', () => {
  const h = createHarness();
  const shifted = h.openMenu({ shiftKey: true });
  assert.equal(shifted.defaultPrevented, false, 'Shift+右键应保留原生菜单');

  const input = new StubElement('input');
  const editable = h.openMenu({ target: input });
  assert.equal(editable.defaultPrevented, false, '输入区域应保留原生菜单');

  h.openMenu();
  h.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(h.host.style.display, 'none');

  const dispose = h.windowStub.__ioxContextMenuDispose;
  assert.equal(typeof dispose, 'function');
  assert.equal(dispose(), true);
  assert.equal(h.host.removed, true);
  assert.equal(h.windowStub.__ioxContextMenuDispose, undefined);
});

test('级联顺序与胶囊条一致，按传入的动作次序依次展开', () => {
  const { icons } = iconTables();
  const h = createHarness({
    actions: [
      { id: 'act_z', name: 'Zeta', icon: 'Grok' },
      { id: 'act_a', name: 'Alpha', icon: 'Claude' },
      { id: 'act_m', name: 'Mid', icon: 'Gemini' },
    ],
  });
  h.openMenu();
  h.items().at(-1).dispatch('click');
  const buttons = h.aiButtons();
  assert.deepEqual(buttons.map((button) => button.getAttribute('aria-label')), ['Zeta', 'Alpha', 'Mid']);
  assert.deepEqual(buttons.map((button) => button.getAttribute('data-action-id')), ['act_z', 'act_a', 'act_m']);
  assert.deepEqual(buttons.map((button) => button.style['--iox-index']), ['0', '1', '2']);
  const sectionHeader = h.submenu.children.find((node) => node.className === 'section-header');
  assert.equal(
    sectionHeader.children.find((node) => node.className === 'section-count').textContent,
    '3',
  );
  for (const [index, key] of ['Grok', 'Claude', 'Gemini'].entries()) {
    assert.equal(buttons[index].children[0].children[0].innerHTML, icons[key].markup);
  }
});
