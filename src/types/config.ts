export type WebWindowMode = 'multi_window' | 'tabbed';
export type LanguageSetting = 'auto' | 'zh' | 'en';

export interface GeneralConfig {
  autoPopupOnSelection: boolean;
  minSelectionLength: number;
  triggerModifier: 'None' | 'Ctrl' | 'Alt' | 'Shift';
  globalHotkey: string;
  theme: 'system' | 'dark' | 'light';
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
  floatingBallPos?: [number, number];
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
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

export type SettingsTab = 'providers' | 'actions' | 'api_card' | 'sessions' | 'web' | 'general' | 'blacklist';


