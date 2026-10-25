import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// config.ts 依赖 zod；data: URL 无法解析裸模块名，先替换为真实的 file: 入口。
const source = readFileSync(new URL('../src/types/config.ts', import.meta.url), 'utf8')
  .replace("from 'zod'", `from '${import.meta.resolve('zod')}'`);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const configModule = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);
const {
  appConfigSchema,
  DEFAULT_API_CARD_SIZE,
  DEFAULT_AUTO_COLLAPSE_THINKING,
  DEFAULT_CONTEXT_TURNS,
  DEFAULT_FILE_DRAG_HOVER_DELAY_MS,
  DEFAULT_FLOATING_BALL_HIDE_DELAY_MS,
  DEFAULT_FLOATING_BALL_HOVER_DELAY_MS,
  DEFAULT_FONT_SIZE,
  DEFAULT_OVERLAY_OPACITY,
  DEFAULT_SEND_KEY_SHORTCUT,
  DEFAULT_SHOW_DURATION,
  DEFAULT_THINKING_OPEN,
  DEFAULT_WEB_WINDOW_SIZE,
  DEFAULT_WEB_DRAG_HOLD_DELAY_MS,
  MAX_WEB_DRAG_HOLD_DELAY_MS,
  DEFAULT_WEB_MENU_PINNED_ACTIONS,
} = configModule;

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/config/default-config.zh.json', import.meta.url), 'utf8')
);

function parseOrFail(value) {
  const parsed = appConfigSchema.safeParse(value);
  if (!parsed.success) {
    assert.fail(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
  }
  return parsed.data;
}

test('the zod contract accepts the Rust default config fixture', () => {
  const config = parseOrFail(fixture);

  assert.equal(config.actions.length, fixture.actions.length);
  assert.equal(config.providers.length, fixture.providers.length);
  assert.deepEqual(config.apiCard.cardSize, fixture.apiCard.cardSize);
  assert.deepEqual(config.general.webWindowSize, fixture.general.webWindowSize);
});

test('shared default constants stay equal to the Rust serialized defaults', () => {
  assert.deepEqual(DEFAULT_API_CARD_SIZE, fixture.apiCard.cardSize);
  assert.deepEqual(DEFAULT_WEB_WINDOW_SIZE, fixture.general.webWindowSize);
  assert.equal(DEFAULT_CONTEXT_TURNS, fixture.apiCard.contextTurns);
  assert.equal(DEFAULT_FONT_SIZE, fixture.apiCard.fontSize);
  assert.equal(DEFAULT_THINKING_OPEN, fixture.apiCard.thinkingDefaultOpen);
  assert.equal(DEFAULT_AUTO_COLLAPSE_THINKING, fixture.apiCard.autoCollapseThinkingOnDone);
  assert.equal(DEFAULT_SHOW_DURATION, fixture.apiCard.showDuration);
  assert.equal(DEFAULT_SEND_KEY_SHORTCUT, fixture.apiCard.sendKeyShortcut);
  assert.equal(DEFAULT_OVERLAY_OPACITY, fixture.general.overlayOpacity);
  assert.equal(DEFAULT_FILE_DRAG_HOVER_DELAY_MS, fixture.general.fileDragHoverDelayMs);
  assert.equal(DEFAULT_FLOATING_BALL_HIDE_DELAY_MS, fixture.general.floatingBallHideDelayMs);
  assert.equal(DEFAULT_FLOATING_BALL_HOVER_DELAY_MS, fixture.general.floatingBallHoverDelayMs);
  assert.equal(DEFAULT_WEB_DRAG_HOLD_DELAY_MS, fixture.general.webDragHoldDelayMs);
  assert.deepEqual(DEFAULT_WEB_MENU_PINNED_ACTIONS, fixture.general.webMenuPinnedActions);
});

test('legacy omissions get the same defaults as the Rust serde defaults', () => {
  const config = parseOrFail({
    general: {
      autoPopupOnSelection: true,
      minSelectionLength: 1,
      triggerModifier: 'None',
      globalHotkey: 'Alt+Space',
      theme: 'system',
      autoStart: false,
    },
    blacklist: [],
    providers: [
      { id: 'p', name: 'P', baseUrl: 'https://example.com/v1', apiKey: '', models: [], defaultModel: '' },
    ],
    actions: [{ id: 'a', name: 'A', icon: 'Globe', actionType: 'web', enabled: true }],
  });

  assert.deepEqual(config.general.webWindowSize, DEFAULT_WEB_WINDOW_SIZE);
  assert.equal(config.general.uiStyle, 'classic');
  assert.equal(config.general.language, 'auto');
  assert.equal(config.general.overlayOpacity, DEFAULT_OVERLAY_OPACITY);
  assert.equal(config.apiCard.contextTurns, DEFAULT_CONTEXT_TURNS);
  assert.equal(config.providers[0].enabled, true);
});

test('null optional action fields normalize to undefined', () => {
  const config = parseOrFail({
    ...fixture,
    actions: [
      {
        id: 'a',
        name: 'A',
        icon: 'Globe',
        actionType: 'web',
        enabled: true,
        providerId: null,
        promptTemplate: null,
        urlTemplate: 'https://example.com',
        copyToClipboard: null,
        inputSelector: null,
        autoSubmit: null,
      },
    ],
  });

  const [action] = config.actions;
  assert.equal(action.providerId, undefined);
  assert.equal(action.promptTemplate, undefined);
  assert.equal(action.copyToClipboard, undefined);
  assert.equal(action.inputSelector, undefined);
  assert.equal(action.autoSubmit, undefined);
  assert.equal(action.urlTemplate, 'https://example.com');
});

test('values outside the contract are rejected', () => {
  const rejected = appConfigSchema.safeParse({
    ...fixture,
    general: { ...fixture.general, triggerModifier: 'Meta' },
  });

  assert.equal(rejected.success, false);
});

test('Web headless mode is opt-in for existing configs and survives serialization', () => {
  const general = { ...fixture.general };
  delete general.webHeadlessMode;
  assert.equal(parseOrFail({ ...fixture, general }).general.webHeadlessMode, false);

  for (const enabled of [true, false]) {
    const config = parseOrFail({ ...fixture, general: { ...general, webHeadlessMode: enabled } });
    assert.equal(parseOrFail(JSON.parse(JSON.stringify(config))).general.webHeadlessMode, enabled);
  }
  assert.equal(fixture.general.webHeadlessMode, false);
  assert.equal(appConfigSchema.safeParse({
    ...fixture, general: { ...general, webHeadlessMode: 'true' },
  }).success, false);
});

test('Web window drag delay defaults for legacy configs and preserves custom milliseconds', () => {
  const general = { ...fixture.general };
  delete general.webDragHoldDelayMs;
  assert.equal(parseOrFail({ ...fixture, general }).general.webDragHoldDelayMs, 300);
  for (const delay of [0, 125, 450, 10000]) {
    const config = parseOrFail({ ...fixture, general: { ...general, webDragHoldDelayMs: delay } });
    assert.equal(parseOrFail(JSON.parse(JSON.stringify(config))).general.webDragHoldDelayMs, delay);
  }
  assert.equal(MAX_WEB_DRAG_HOLD_DELAY_MS, 10000);
  for (const invalid of [-1, 1.5, 10001, '300', null]) {
    assert.equal(appConfigSchema.safeParse({
      ...fixture, general: { ...general, webDragHoldDelayMs: invalid },
    }).success, false, `delay ${invalid} must be rejected`);
  }
});

test('Web wheel pins preserve empty and ordered choices with a legacy default', () => {
  const general = { ...fixture.general };
  delete general.webMenuPinnedActions;
  assert.deepEqual(parseOrFail({ ...fixture, general }).general.webMenuPinnedActions, ['reload', 'openExternal', 'history', 'minimize']);
  for (const pins of [[], ['closeWindow', 'reload'], ['reload', 'openExternal', 'history', 'settings', 'moveWindow', 'minimize', 'maximize', 'closeWindow']]) {
    const parsed = parseOrFail({ ...fixture, general: { ...general, webMenuPinnedActions: pins } });
    assert.deepEqual(parseOrFail(JSON.parse(JSON.stringify(parsed))).general.webMenuPinnedActions, pins);
  }
  for (const pins of [['unknown'], ['reload', 'reload'], null, 'reload']) {
    assert.equal(appConfigSchema.safeParse({ ...fixture, general: { ...general, webMenuPinnedActions: pins } }).success, false);
  }
});
