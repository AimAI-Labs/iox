import { z } from 'zod';

/**
 * 配置契约的共享默认值。
 *
 * Rust `config.rs` 是持久化格式的事实来源；这里的常量与 `appConfigSchema` 的
 * `.default()` 一并由 `tests/config-contract.test.mjs` 对照后端默认配置夹具锁定。
 */
export const DEFAULT_API_CARD_SIZE: [number, number] = [600, 900];
export const DEFAULT_WEB_WINDOW_SIZE: [number, number] = [860, 640];
export const DEFAULT_WEB_DRAG_HOLD_DELAY_MS = 300;
export const MAX_WEB_DRAG_HOLD_DELAY_MS = 10000;
export const DEFAULT_OVERLAY_OPACITY = 90;
export const DEFAULT_CONTEXT_TURNS = 5;
export const DEFAULT_FONT_SIZE = 13;
export const DEFAULT_THINKING_OPEN = true;
export const DEFAULT_AUTO_COLLAPSE_THINKING = true;
export const DEFAULT_SHOW_DURATION = true;
export const DEFAULT_SEND_KEY_SHORTCUT = 'Enter';
export const DEFAULT_FILE_DRAG_HOVER_DELAY_MS = 1000;
export const DEFAULT_FLOATING_BALL_HIDE_DELAY_MS = 2500;
export const DEFAULT_FLOATING_BALL_HOVER_DELAY_MS = 220;

export const webWindowModeSchema = z.enum(['multi_window', 'tabbed']);
export type WebWindowMode = z.infer<typeof webWindowModeSchema>;

export const languageSettingSchema = z.enum(['auto', 'zh', 'en']);
export type LanguageSetting = z.infer<typeof languageSettingSchema>;

/** 界面样式标识：classic = 自绘圆角（默认），windows = 系统标题栏 + 直角 */
export const uiStyleSchema = z.enum(['classic', 'windows']);
export type UiStyle = z.infer<typeof uiStyleSchema>;

const triggerModifierSchema = z.enum(['None', 'Ctrl', 'Alt', 'Shift']);
const themeSchema = z.enum(['system', 'dark', 'light']);

/** 二维尺寸；Rust 以元组序列化为 `[width, height]`。 */
const sizePairSchema = (defaultSize: [number, number]) =>
  z
    .tuple([z.number().positive(), z.number().positive()])
    .default((): [number, number] => [defaultSize[0], defaultSize[1]]);

/** Rust 的 `Option` 字段可能序列化为 `null`；进入对象校验前归一为缺省键，保持前端既有语义。 */
const withoutNullFields = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, entry === null ? undefined : entry])
      );
    }
    return value;
  }, schema);

export const generalConfigSchema = z.object({
  autoPopupOnSelection: z.boolean(),
  autoPopupOnFileSelection: z.boolean().default(false),
  fileDragHoverDelayMs: z.number().int().nonnegative().default(DEFAULT_FILE_DRAG_HOVER_DELAY_MS),
  minSelectionLength: z.number().int().nonnegative(),
  triggerModifier: triggerModifierSchema,
  globalHotkey: z.string(),
  theme: themeSchema,
  uiStyle: uiStyleSchema.default('classic'),
  autoStart: z.boolean(),
  webWindowMode: webWindowModeSchema.default('multi_window'),
  webHeadlessMode: z.boolean().default(false),
  webDragHoldDelayMs: z.number().int().min(0).max(MAX_WEB_DRAG_HOLD_DELAY_MS).default(DEFAULT_WEB_DRAG_HOLD_DELAY_MS),
  autoCopyOnWebAction: z.boolean().default(false),
  overlayOpacity: z.number().int().nonnegative().default(DEFAULT_OVERLAY_OPACITY),
  webWindowSize: sizePairSchema(DEFAULT_WEB_WINDOW_SIZE),
  /** 旧字段：仅作为一次性迁移输入，提交时后端会归零。 */
  apiCardSize: sizePairSchema(DEFAULT_API_CARD_SIZE),
  iconOnlyBubble: z.boolean().default(false),
  enableFloatingBall: z.boolean().default(true),
  floatingBallAutoHide: z.boolean().default(true),
  floatingBallHideDelayMs: z.number().int().nonnegative().default(DEFAULT_FLOATING_BALL_HIDE_DELAY_MS),
  floatingBallHoverDelayMs: z.number().int().nonnegative().default(DEFAULT_FLOATING_BALL_HOVER_DELAY_MS),
  floatingBallPos: z.tuple([z.number().int(), z.number().int()]).default((): [number, number] => [0, 0]),
  language: languageSettingSchema.default('auto'),
});
export type GeneralConfig = z.infer<typeof generalConfigSchema>;

export const providerConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  apiKey: z.string(),
  models: z.array(z.string()),
  defaultModel: z.string(),
  /** 是否作为可选来源出现在选择器中；旧配置缺省时视为启用。停用不阻断已绑定动作的执行。 */
  enabled: z.boolean().default(true),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const actionTypeSchema = z.enum(['api', 'web', 'copy']);
export type ActionType = z.infer<typeof actionTypeSchema>;

export const actionConfigSchema = withoutNullFields(z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  actionType: actionTypeSchema,
  providerId: z.string().optional(),
  promptTemplate: z.string().optional(),
  urlTemplate: z.string().optional(),
  copyToClipboard: z.boolean().optional(),
  enabled: z.boolean(),
  inputSelector: z.string().optional(),
  submitSelector: z.string().optional(),
  autoSubmit: z.boolean().optional(),
  useUrlTemplate: z.boolean().optional(),
}));
export type ActionConfig = z.infer<typeof actionConfigSchema>;

const sendKeyShortcutSchema = z.enum(['Enter', 'Ctrl+Enter']);

export const apiCardConfigSchema = z.object({
  cardSize: sizePairSchema(DEFAULT_API_CARD_SIZE),
  autoPinOnOpen: z.boolean().default(false),
  autoFocusInput: z.boolean().default(false),
  thinkingDefaultOpen: z.boolean().default(DEFAULT_THINKING_OPEN),
  autoCollapseThinkingOnDone: z.boolean().default(DEFAULT_AUTO_COLLAPSE_THINKING),
  showDuration: z.boolean().default(DEFAULT_SHOW_DURATION),
  fontSize: z.number().int().positive().default(DEFAULT_FONT_SIZE),
  codeBlockWrap: z.boolean().default(false),
  codeBlockLineNumbers: z.boolean().default(false),
  contextTurns: z.number().int().nonnegative().default(DEFAULT_CONTEXT_TURNS),
  sendKeyShortcut: sendKeyShortcutSchema.default(DEFAULT_SEND_KEY_SHORTCUT),
});
export type ApiCardConfig = z.infer<typeof apiCardConfigSchema>;

export const appConfigSchema = z.object({
  general: generalConfigSchema,
  blacklist: z.array(z.string()),
  providers: z.array(providerConfigSchema),
  actions: z.array(actionConfigSchema),
  apiCard: apiCardConfigSchema.default(() => apiCardConfigSchema.parse({})),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

export interface WebHubTabItem {
  actionId: string;
  name: string;
  icon: string;
  url: string;
}

export interface WebHubState {
  tabs: WebHubTabItem[];
  activeTabId: string | null;
}

export interface PickedProcessInfo {
  processName: string;
  windowTitle: string;
}

export type SettingsTab = 'providers' | 'actions' | 'api_card' | 'sessions' | 'web_sessions' | 'web' | 'general' | 'blacklist';
