export type WebWindowMode = 'multi_window' | 'tabbed';
export type LanguageSetting = 'auto' | 'zh' | 'en';
/** 界面样式标识：classic = 自绘圆角（默认），windows = 系统标题栏 + 直角 */
export type UiStyle = 'classic' | 'windows';

export interface GeneralConfig {
  autoPopupOnSelection: boolean;
  autoPopupOnFileSelection?: boolean;
  fileDragHoverDelayMs?: number;
  minSelectionLength: number;
  triggerModifier: 'None' | 'Ctrl' | 'Alt' | 'Shift';
  globalHotkey: string;
  theme: 'system' | 'dark' | 'light';
  uiStyle?: UiStyle;
  autoStart: boolean;
  webWindowMode: WebWindowMode;
  autoCopyOnWebAction: boolean;
  language: LanguageSetting;
  overlayOpacity?: number;
  webWindowSize?: [number, number];
  apiCardSize?: [number, number];
  iconOnlyBubble?: boolean;
  enableFloatingBall?: boolean;
  floatingBallAutoHide?: boolean;
  floatingBallHideDelayMs?: number;
  floatingBallHoverDelayMs?: number;
  floatingBallPos?: [number, number];
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  /** 是否启用；旧配置缺省时视为启用 */
  enabled?: boolean;
}

export type ActionType = 'api' | 'web' | 'copy';

export interface ActionConfig {
  id: string;
  name: string;
  icon: string;
  actionType: ActionType;
  providerId?: string;
  promptTemplate?: string;
  urlTemplate?: string;
  copyToClipboard?: boolean;
  enabled: boolean;
  inputSelector?: string;
  submitSelector?: string;
  autoSubmit?: boolean;
  useUrlTemplate?: boolean;
}

export interface ApiCardConfig {
  cardSize: [number, number];
  autoPinOnOpen: boolean;
  autoFocusInput: boolean;
  thinkingDefaultOpen: boolean;
  autoCollapseThinkingOnDone: boolean;
  showDuration: boolean;
  fontSize: number;
  codeBlockWrap: boolean;
  codeBlockLineNumbers: boolean;
  contextTurns: number;
  sendKeyShortcut: 'Enter' | 'Ctrl+Enter';
}

export interface AppConfig {
  general: GeneralConfig;
  blacklist: string[];
  providers: ProviderConfig[];
  actions: ActionConfig[];
  apiCard: ApiCardConfig;
}

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


