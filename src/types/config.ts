export type WebWindowMode = 'multi_window' | 'tabbed';

export interface GeneralConfig {
  autoPopupOnSelection: boolean;
  minSelectionLength: number;
  triggerModifier: 'None' | 'Ctrl' | 'Alt' | 'Shift';
  globalHotkey: string;
  theme: 'system' | 'dark' | 'light';
  autoStart: boolean;
  webWindowMode: WebWindowMode;
  autoCopyOnWebAction: boolean;
  overlayOpacity?: number;
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
}

export interface AppConfig {
  general: GeneralConfig;
  blacklist: string[];
  providers: ProviderConfig[];
  actions: ActionConfig[];
}
