#!/usr/bin/env node
/**
 * 生成官网右键菜单级联项使用的图标数据。
 *
 * 注入脚本运行在第三方页面的 closed shadow root 中，不能直接使用 React 的
 * `DynamicIcon`，因此这里把与前端同源的单色 SVG 几何图形导出为静态 JS 表。
 *
 * 数据来源：
 * - `node_modules/@lobehub/icons` (MIT)：各品牌 `components/Mono.js`
 * - `node_modules/lucide-react` (ISC)：通用功能图标 `dist/esm/icons/*.mjs`
 * - `src/components/Icons.tsx` / `src/assets/xiaomi.svg`：项目自定义品牌图标
 * - `src/components/Icons.tsx`：`AI_ICON_MAP` / `LUCIDE_ICON_MAP` / `ALIAS_MAP` / 品牌色
 *
 * 用法：node scripts/generate-web-context-menu-icons.mjs
 * 输出：src-tauri/src/ai/web_context_menu_icons.js（生成文件，勿手动修改）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const lobeMono = (key) => path.join(root, 'node_modules/@lobehub/icons/es', key, 'components/Mono.js');
const lobeStyle = (key) => path.join(root, 'node_modules/@lobehub/icons/es', key, 'style.js');
const lucideIcon = (name) => path.join(root, 'node_modules/lucide-react/dist/esm/icons', `${name}.mjs`);
const outputPath = path.join(root, 'src-tauri/src/ai/web_context_menu_icons.js');

const iconsSource = read('src/components/Icons.tsx');

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
if (!brandKeys.includes('Sparkles') && !lucideKeys.includes('Sparkles')) {
  throw new Error('Icons.tsx 缺少 Sparkles 回退图标');
}

const aliases = {};
for (const line of block(iconsSource, 'ALIAS_MAP').split('\n')) {
  const match = line.match(/^\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_-]+))\s*:\s*'([^']+)',?/);
  if (match) aliases[(match[1] || match[2] || match[3]).toLowerCase()] = match[4];
}

const customColors = {};
const colorBlock = iconsSource.match(/const customColors[^=]*=\s*\{([\s\S]*?)\n\s*\};/);
if (colorBlock) {
  for (const match of colorBlock[1].matchAll(/([A-Za-z0-9_]+)\s*:\s*'(#[0-9A-Fa-f]{3,8})'/g)) {
    customColors[match[1]] = match[2];
  }
}

const GEOMETRY = new Set([
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'points', 'fillRule', 'clipRule', 'strokeWidth',
  'strokeLinecap', 'strokeLinejoin', 'strokeDasharray',
]);
const ATTR_NAMES = {
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
};
const SHAPE_TAGS = new Set([
  'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
]);

const escapeAttr = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** 只序列化几何属性；颜色统一由外层 svg 的 currentColor 决定。 */
function serialize(tag, attrs) {
  if (!SHAPE_TAGS.has(tag)) return '';
  const parts = Object.entries(attrs)
    .filter(([name]) => GEOMETRY.has(name))
    .map(([name, value]) => `${ATTR_NAMES[name] || name}="${escapeAttr(value)}"`);
  if (parts.length === 0) return '';
  return `<${tag} ${parts.join(' ')}/>`;
}

function jsAttributes(body) {
  const attrs = {};
  const pattern = /([A-Za-z][A-Za-z0-9]*)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([-\d.]+))/g;
  for (const match of body.matchAll(pattern)) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4];
  }
  return attrs;
}

/** 从 LobeHub 的 Mono React 组件提取 SVG 图形。 */
function fromLobeMono(key) {
  const file = lobeMono(key);
  if (!fs.existsSync(file)) return null;
  const source = fs.readFileSync(file, 'utf8');
  // 渐变 / 剪裁等复杂结构交给回退图标，避免生成不完整的图形。
  if (/\b(?:defs|linearGradient|radialGradient|clipPath|mask|url\()/.test(source)) return null;
  const body = source.slice(source.indexOf('children:'));
  const markup = [];
  for (const match of body.matchAll(/_(?:jsx|jsxs)\("([a-zA-Z]+)",\s*\{([\s\S]*?)\}\)/g)) {
    markup.push(serialize(match[1], jsAttributes(match[2])));
  }
  const shapes = markup.filter(Boolean).join('');
  if (!shapes) return null;
  const strokeMode = /\bfill:\s*"none"|\bstroke:\s*"currentColor"/.test(source);
  return { markup: shapes, mode: strokeMode ? 'stroke' : 'fill' };
}

/** 从 lucide-react 的 __iconNode 数组提取 SVG 图形；旧图标名会重导出到新文件。 */
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
  const markup = [];
  const nodes = source.slice(start, end);
  for (const match of nodes.matchAll(/\[\s*"([a-zA-Z]+)",\s*\{([\s\S]*?)\}\s*\]/g)) {
    markup.push(serialize(match[1], jsAttributes(match[2])));
  }
  const shapes = markup.filter(Boolean).join('');
  return shapes ? { markup: shapes, mode: 'stroke' } : null;
}

/** 从项目自定义 SVG（Icons.tsx 组件或 .svg 文件）提取 SVG 图形。 */
function fromSvgFragment(fragment, mode) {
  const markup = [];
  for (const match of fragment.matchAll(/<(path|circle|ellipse|rect|line|polyline|polygon)\b([^>]*?)\/?>/g)) {
    const attrs = {};
    for (const attr of match[2].matchAll(/([A-Za-z][A-Za-z0-9]*)\s*=\s*"([^"]*)"/g)) {
      attrs[attr[1]] = attr[2];
    }
    markup.push(serialize(match[1], attrs));
  }
  const shapes = markup.filter(Boolean).join('');
  return shapes ? { markup: shapes, mode } : null;
}

function customComponent(name) {
  const start = iconsSource.indexOf(`const ${name}`);
  if (start < 0) return '';
  const end = iconsSource.indexOf('\nconst ', start + 1);
  return iconsSource.slice(start, end < 0 ? undefined : end);
}

const customIcons = {
  Metaso: fromSvgFragment(customComponent('MetasoMono'), 'fill'),
  Felo: fromSvgFragment(customComponent('FeloMono'), 'stroke'),
  Xiaomi: fromSvgFragment(read('src/assets/xiaomi.svg'), 'fill'),
};

/** 品牌主色：优先前端自定义色，其次 LobeHub 的 COLOR_PRIMARY。单色黑白交由主题前景色。 */
function brandColor(key) {
  const candidates = [customColors[key]];
  const styleFile = lobeStyle(key);
  if (fs.existsSync(styleFile)) {
    const match = fs.readFileSync(styleFile, 'utf8').match(/COLOR_PRIMARY\s*=\s*['"]([^'"]+)['"]/);
    candidates.push(match?.[1]);
  }
  for (const color of candidates) {
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) continue;
    const value = parseInt(color.slice(1), 16);
    const luminance = (
      0.2126 * ((value >> 16) & 255)
      + 0.7152 * ((value >> 8) & 255)
      + 0.0722 * (value & 255)
    ) / 255;
    // 过亮 / 过暗的品牌色在暗浅面板中总有一侧看不清，交由主题前景色接管。
    if (luminance > 0.78 || luminance < 0.12) continue;
    return color.toUpperCase();
  }
  return null;
}

const icons = {};
const missing = [];
for (const key of brandKeys) {
  const entry = customIcons[key] || fromLobeMono(key);
  if (!entry) {
    missing.push(key);
    continue;
  }
  icons[key] = { ...entry, color: brandColor(key) };
}
for (const key of lucideKeys) {
  if (icons[key]) continue;
  const entry = fromLucide(key);
  if (!entry) {
    missing.push(key);
    continue;
  }
  icons[key] = { ...entry, color: null };
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
  ' * 图形来源：@lobehub/icons (MIT) Mono 组件、lucide-react (ISC) 与项目自定义 SVG。',
  ' * 只含 SVG 几何图形，颜色由右键菜单在运行时按品牌色 / 主题决定。',
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
