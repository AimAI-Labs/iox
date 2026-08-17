export interface GeneralConfig {
  autoPopupOnSelection: boolean;
  minSelectionLength: number;
  triggerModifier: 'None' | 'Ctrl' | 'Alt' | 'Shift';
  globalHotkey: string;
  theme: 'system' | 'dark' | 'light';
  autoStart: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
}

export type ActionType = 'api' | 'web';

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
}

export interface AppConfig {
  general: GeneralConfig;
  blacklist: string[];
  providers: ProviderConfig[];
  actions: ActionConfig[];
}
