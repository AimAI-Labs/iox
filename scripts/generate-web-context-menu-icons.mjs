#!/usr/bin/env node
/**
 * 生成官网右键菜单级联项使用的图标数据。
 *
 * 注入脚本运行在第三方页面的 closed shadow root 中，无法直接渲染 React 的
 * `DynamicIcon`，因此这里把与划词胶囊条同源的 SVG 导出为静态表：
 * - 品牌图标优先取 `Color` 变体（多色官方图形，与胶囊条逐像素一致）；
 * - 没有 `Color` 变体时退回 `Mono` 变体，颜色交由 `currentColor` 继承主题前景色；
 * - 通用功能图标继续使用 lucide-react 的单色线性图形。
 *
 * 数据来源：
 * - `node_modules/@lobehub/icons` (MIT)：`components/Color.js` / `components/Mono.js`
 * - `node_modules/lucide-react` (ISC)：`dist/esm/icons/*.mjs`
 * - `src/components/Icons.tsx`、`src/assets/xiaomi.svg`：项目自定义品牌图标
 *
 * 用法：node scripts/generate-web-context-menu-icons.mjs
 * 输出：src-tauri/src/ai/web_context_menu_icons.js（生成文件，勿手动修改）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const lobeComponent = (key, variant) => path.join(root, 'node_modules/@lobehub/icons/es', key, `components/${variant}.js`);
const lucideIcon = (name) => path.join(root, 'node_modules/lucide-react/dist/esm/icons', `${name}.mjs`);
const outputPath = path.join(root, 'src-tauri/src/ai/web_context_menu_icons.js');

const iconsSource = read('src/components/Icons.tsx');

const SHAPE_TAGS = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
const CONTAINER_TAGS = new Set([
  'defs', 'g', 'linearGradient', 'radialGradient', 'stop', 'filter',
  'feFlood', 'feBlend', 'feColorMatrix', 'feOffset', 'feGaussianBlur', 'feComposite',
]);
/** 带 `id` 且被 `url(#id)` 引用的容器；注入到同一 shadow root 时必须逐图标重命名。 */
const ID_TAGS = new Set(['linearGradient', 'radialGradient', 'filter', 'clipPath', 'mask']);
const REF_ATTRS = new Set(['fill', 'filter', 'clip-path', 'mask', 'stroke']);
/** React 的 camelCase 属性名到 SVG 属性名。 */
const ATTR_NAMES = {
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  stopColor: 'stop-color',
  stopOpacity: 'stop-opacity',
  fillOpacity: 'fill-opacity',
  strokeOpacity: 'stroke-opacity',
  floodColor: 'flood-color',
  floodOpacity: 'flood-opacity',
  colorInterpolationFilters: 'color-interpolation-filters',
};
const ALLOWED_ATTRS = new Set([
  'viewBox', 'id', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'points', 'offset', 'transform', 'fill', 'stroke', 'fill-rule', 'clip-rule',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'fill-opacity',
  'stroke-opacity', 'opacity', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
  'color-interpolation-filters', 'filter', 'filterUnits', 'result', 'in', 'in2', 'operator',
  'k2', 'k3', 'k4', 'stdDeviation', 'values', 'flood-color', 'flood-opacity',
]);
/** 只保留 svg 根上的绘制语义，尺寸由调用方决定。 */
const ROOT_ATTRS = new Set(['viewBox', 'fill', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']);
const DEFAULT_VIEW_BOX = '0 0 24 24';

function block(source, name) {
  const match = source.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  if (!match) throw new Error(`无法在 Icons.tsx 中定位 ${name}`);
  return match[1];
}

function keysOf(blockText) {
  return [...blockText.matchAll(/^\s*([A-Za-z0-9_]+)\s*,?\s*$/gm)].map((match) => match[1]);
}

const brandKeys = keysOf(block(iconsSource, 'AI_ICON_MAP'));
const lucideKeys = keysOf(block(iconsSource, 'LUCIDE_ICON_MAP'));
if (!lucideKeys.includes('Sparkles')) {
  throw new Error('Icons.tsx 缺少 Sparkles 回退图标');
}

const aliases = {};
for (const line of block(iconsSource, 'ALIAS_MAP').split('\n')) {
  const match = line.match(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*'([^']+)',?/);
  if (match) aliases[(match[1] || match[2] || match[3]).toLowerCase()] = match[4];
}

const escapeAttr = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/* ------------------------------------------------------------------ JSX 解析 */

function matchBrace(source, start) {
  let depth = 0;
  let quote = '';
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return i;
  }
  return -1;
}

/** 读取一个属性值：字符串、数字或标识符引用（如 `a.fill`）。 */
function readValue(props, start) {
  const char = props[start];
  if (char === '"' || char === "'") {
    let value = '';
    let i = start + 1;
    while (i < props.length) {
      const current = props[i];
      if (current === '\\') { value += props[i + 1]; i += 2; continue; }
      if (current === char) break;
      value += current;
      i++;
    }
    return { value, end: i + 1 };
  }
  const number = /^-?\d+(?:\.\d+)?/.exec(props.slice(start));
  if (number) return { value: Number(number[0]), end: start + number[0].length };
  const identifier = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\[\d+\])?/.exec(props.slice(start));
  if (identifier) return { value: { ref: identifier[0] }, end: start + identifier[0].length };
  return { value: null, end: start + 1 };
}

/** 解析 `{ ... }` 内的顶层属性；嵌套元素留给 children 递归。 */
function parseAttrs(props) {
  const attrs = {};
  let depth = 0;
  let quote = '';
  for (let i = 0; i < props.length; i++) {
    const char = props[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{' || char === '[' || char === '(') { depth++; continue; }
    if (char === '}' || char === ']' || char === ')') { depth--; continue; }
    if (depth !== 0) continue;
    const key = /^([A-Za-z_$][\w$]*)\s*:\s*/.exec(props.slice(i));
    if (!key || (i > 0 && !/[\s,{]/.test(props[i - 1]))) continue;
    const value = readValue(props, i + key[0].length);
    attrs[key[1]] = value.value;
    i = value.end - 1;
  }
  return attrs;
}

function parseCalls(source, from, to) {
  const nodes = [];
  const regex = /_(?:jsx|jsxs)\(\s*"([A-Za-z][\w]*)"/g;
  regex.lastIndex = from;
  let match;
  while ((match = regex.exec(source)) && match.index < to) {
    const brace = source.indexOf('{', source.indexOf(',', match.index + match[0].length));
    const end = brace < 0 ? -1 : matchBrace(source, brace);
    if (end < 0) break;
    const props = source.slice(brace + 1, end);
    nodes.push({ tag: match[1], attrs: parseAttrs(props), children: parseCalls(props, 0, props.length) });
    regex.lastIndex = end + 1;
  }
  return nodes;
}

/** 从 LobeHub 的 `_jsx` 组件里取出根 svg 视图信息与图形树。 */
function fromLobeComponent(key, variant) {
  const file = lobeComponent(key, variant);
  if (!fs.existsSync(file)) return null;
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('children:');
  if (start < 0) return null;
  const nodes = parseCalls(source, start, source.length);
  const shapes = nodes.filter((node) => SHAPE_TAGS.has(node.tag));
  if (!shapes.length) return null;
  const head = source.slice(0, start);
  const viewBox = /viewBox:\s*"([^"]+)"/.exec(head)?.[1] ?? DEFAULT_VIEW_BOX;
  const rootAttrs = { viewBox };
  for (const match of head.matchAll(/\b(fill|fillRule|stroke|strokeWidth|strokeLinecap|strokeLinejoin)\s*:\s*"([^"]*)"/g)) {
    rootAttrs[ATTR_NAMES[match[1]] ?? match[1]] = match[2];
  }
  const fillAliases = new Map();
  for (const match of head.matchAll(/([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\.(?:id|fill)\b/g)) {
    const canonical = fillAliases.get(match[2]);
    if (!canonical) fillAliases.set(match[2], match[1]);
    else fillAliases.set(match[1], canonical);
  }
  return { nodes, rootAttrs, fillAliases };
}

/* -------------------------------------------------------------- SVG 片段解析 */

function parseSvgAttrs(raw) {
  const attrs = {};
  for (const match of raw.matchAll(/([A-Za-z_:][\w:-]*)\s*=\s*"([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

/** 解析项目自定义的静态 `<svg>` 片段（含 defs / 渐变）。 */
function fromSvgFragment(fragment) {
  const tree = { tag: 'svg', attrs: {}, children: [] };
  const stack = [tree];
  for (const match of fragment.matchAll(/<\s*(\/?)\s*([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)>/g)) {
    if (match[1]) { if (stack.length > 1) stack.pop(); continue; }
    const node = { tag: match[2], attrs: parseSvgAttrs(match[3]), children: [] };
    stack[stack.length - 1].children.push(node);
    // 自闭合标签由原始文本结尾判定，避免惰性匹配把 `/` 吞进属性段。
    if (!/\/\s*>$/.test(match[0])) stack.push(node);
  }
  // 片段本身是完整 `<svg>`：视图信息取自根元素，图形取其子节点。
  const element = tree.children.find((node) => node.tag === 'svg') ?? tree;
  const rootAttrs = {};
  for (const [name, value] of Object.entries(element.attrs)) {
    if (ROOT_ATTRS.has(name) && value) rootAttrs[name] = value;
  }
  if (!rootAttrs.viewBox) rootAttrs.viewBox = DEFAULT_VIEW_BOX;
  const nodes = element.children;
  if (!nodes.some((node) => SHAPE_TAGS.has(node.tag))) return null;
  return { nodes, rootAttrs, fillAliases: new Map() };
}

function customComponent(name) {
  const start = iconsSource.indexOf(`const ${name}`);
  if (start < 0) return '';
  const end = iconsSource.indexOf('\nconst ', start + 1);
  return iconsSource.slice(start, end < 0 ? undefined : end);
}

/** 与 `DynamicIcon` 一致：自定义组件优先，其次 Color，最后 Mono。 */
const customIcons = {
  Xiaomi: () => fromSvgFragment(read('src/assets/xiaomi.svg')),
  Kimi: () => fromSvgFragment(customComponent('KimiColor')),
  Metaso: () => fromSvgFragment(customComponent('MetasoColor')),
  Felo: () => fromSvgFragment(customComponent('FeloColor')),
};

/* ------------------------------------------------------------------ 序列化 */

/** 引用形如 `a.fill` / `fill` 统一成渐变对象的基名。 */
function refBase(ref, fillAliases) {
  const base = ref.replace(/\.(?:id|fill)$/, '');
  return fillAliases.get(base) ?? base;
}

function assignIds(nodes, slug, fillAliases) {
  const ids = new Map();
  let counter = 0;
  const walk = (list) => {
    for (const node of list) {
      if (ID_TAGS.has(node.tag) && node.attrs.id !== undefined) {
        const raw = node.attrs.id;
        const key = raw && typeof raw === 'object' ? refBase(raw.ref, fillAliases) : String(raw);
        if (!ids.has(key)) ids.set(key, `iox-${slug}-${++counter}`);
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

function resolveValue(name, value, ids, fillAliases) {
  if (value && typeof value === 'object') {
    const id = ids.get(refBase(value.ref, fillAliases));
    if (!id) return null;
    if (name === 'id') return id;
    return REF_ATTRS.has(name) ? `url(#${id})` : null;
  }
  if (typeof value !== 'string') return value;
  if (name === 'id') return ids.get(value) ?? null;
  return value.replace(/url\(#([^)\s]+)\)/g, (whole, original) => {
    const id = ids.get(original);
    return id ? `url(#${id})` : whole;
  });
}

function serializeNode(node, ids, fillAliases) {
  if (!SHAPE_TAGS.has(node.tag) && !CONTAINER_TAGS.has(node.tag)) return '';
  const parts = [];
  for (const [rawName, rawValue] of Object.entries(node.attrs)) {
    const name = ATTR_NAMES[rawName] ?? rawName;
    if (name === 'children' || !ALLOWED_ATTRS.has(name)) continue;
    const value = resolveValue(name, rawValue, ids, fillAliases);
    if (value === null || value === undefined || value === '') continue;
    parts.push(`${name}="${escapeAttr(value)}"`);
  }
  const children = node.children.map((child) => serializeNode(child, ids, fillAliases)).join('');
  if (!children) return parts.length ? `<${node.tag} ${parts.join(' ')}/>` : '';
  const open = parts.length ? `<${node.tag} ${parts.join(' ')}>` : `<${node.tag}>`;
  return `${open}${children}</${node.tag}>`;
}

function buildEntry(slug, fragment) {
  const ids = assignIds(fragment.nodes, slug, fragment.fillAliases);
  const markup = fragment.nodes.map((node) => serializeNode(node, ids, fragment.fillAliases)).join('');
  if (!markup) return null;
  const attrs = {};
  for (const [name, value] of Object.entries(fragment.rootAttrs)) {
    if (ROOT_ATTRS.has(name) && value) attrs[name] = value;
  }
  if (!attrs.viewBox) attrs.viewBox = DEFAULT_VIEW_BOX;
  return { attrs, markup };
}

/* ------------------------------------------------------------------ lucide */

function fromLucide(key, depth = 0) {
  if (depth > 3) return null;
  const name = key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .toLowerCase();
  const file = lucideIcon(name);
  if (!fs.existsSync(file)) return null;
  const source = fs.readFileSync(file, 'utf8');
  const reexport = source.match(/export\s*\{\s*default\s*\}\s*from\s*'\.\/([^']+)\.mjs'/);
  if (reexport) return fromLucide(reexport[1], depth + 1);
  const start = source.indexOf('__iconNode = [');
  const end = source.indexOf('];', start);
  if (start < 0 || end < 0) return null;
  const nodes = [];
  for (const match of source.slice(start, end).matchAll(/\[\s*"([a-zA-Z]+)",\s*\{([\s\S]*?)\}\s*\]/g)) {
    nodes.push({ tag: match[1], attrs: parseAttrs(match[2]), children: [] });
  }
  if (!nodes.length) return null;
  return {
    nodes,
    rootAttrs: {
      viewBox: DEFAULT_VIEW_BOX,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    fillAliases: new Map(),
  };
}

/* ------------------------------------------------------------------ 生成 */

const icons = {};
const missing = [];
for (const key of brandKeys) {
  const slug = key.toLowerCase();
  const fragment = (customIcons[key]?.() ?? null)
    || fromLobeComponent(key, 'Color')
    || fromLobeComponent(key, 'Mono');
  const entry = fragment ? buildEntry(slug, fragment) : null;
  if (!entry) { missing.push(key); continue; }
  icons[key] = entry;
}
for (const key of lucideKeys) {
  if (icons[key]) continue;
  const fragment = fromLucide(key);
  const entry = fragment ? buildEntry(key.toLowerCase(), fragment) : null;
  if (!entry) { missing.push(key); continue; }
  icons[key] = entry;
}
if (!icons.Sparkles) throw new Error('缺少 Sparkles 图标，无法生成回退图形');

// 名称 / id 推断只使用能映射到品牌图标的别名，避免动作名里的通用词误命中。
const brandSet = new Set([...brandKeys, ...Object.keys(customIcons)]);
const keywords = [...new Set(Object.entries(aliases)
  .filter(([alias, key]) => alias.length >= 3 && brandSet.has(key))
  .map(([alias, key]) => `${alias}\u0000${key}`))]
  .map((pair) => pair.split('\u0000'))
  .sort((a, b) => b[0].length - a[0].length);
const validAliases = Object.fromEntries(Object.entries(aliases)
  .filter(([, key]) => icons[key])
  .sort(([a], [b]) => a.localeCompare(b)));

const lines = [
  '/**',
  ' * 自动生成文件，请勿手动修改。',
  ' * 生成命令：node scripts/generate-web-context-menu-icons.mjs',
  ' * 图形来源：@lobehub/icons (MIT) 的 Color / Mono 变体、lucide-react (ISC) 与项目自定义 SVG。',
  ' * 与划词胶囊条的 DynamicIcon 同源：品牌 Color 变体保留官方多色，Mono 变体继承 currentColor。',
  ' */',
  'const IOX_MENU_ICONS = {',
  ...Object.entries(icons)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`),
  '};',
  'const IOX_MENU_ICON_ALIASES = {',
  ...Object.entries(validAliases)
    .map(([alias, key]) => `  ${JSON.stringify(alias)}: ${JSON.stringify(key)},`),
  '};',
  'const IOX_MENU_ICON_KEYWORDS = [',
  ...keywords.map(([alias, key]) => `  [${JSON.stringify(alias)}, ${JSON.stringify(key)}],`),
  '];',
  '',
];
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`已生成 ${Object.keys(icons).length} 个图标、${Object.keys(validAliases).length} 个别名 -> src-tauri/src/ai/web_context_menu_icons.js`);
if (missing.length) console.warn(`未找到图形（运行时回退 Sparkles）：${missing.join(', ')}`);
