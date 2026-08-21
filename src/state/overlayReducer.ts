import { ActionConfig } from '@/types/config';

export type OverlayMode = 'bubble' | 'card';

export interface OverlayState {
  mode: OverlayMode;
  visible: boolean;
  selectedText: string;
  activeAction: ActionConfig | null;
  selectedModel: string;
  streamText: string;
  isLoading: boolean;
  isPinned: boolean;
  error: string | null;
  isClosing: boolean;
  animKey: number;
  thinkingMode: 'quick' | 'deep';
  currentSessionId: string | null;
}

// 跨会话记忆钉住偏好：重启/隐藏后恢复，配合后端
// 「钉住 && 可见 && 卡片态」的零打扰判定，不会造成划词死锁
const getInitialPinnedState = (): boolean => {
  try {
    return localStorage.getItem('iox_overlay_pinned') === 'true';
  } catch {
    return false;
  }
};

export const initialOverlayState: OverlayState = {
  mode: 'bubble',
  visible: false,
  selectedText: '',
  activeAction: null,
  selectedModel: '',
  streamText: '',
  isLoading: false,
  isPinned: getInitialPinnedState(),
  error: null,
  isClosing: false,
  animKey: 0,
  thinkingMode: 'quick',
  currentSessionId: null,
};

export type OverlayAction =
  | { type: 'SELECTION_TRIGGERED'; text: string }
  | { type: 'SET_MODE'; mode: OverlayMode }
  | { type: 'START_ACTION'; action: ActionConfig; model?: string }
  | { type: 'START_EMPTY_CARD_ACTION'; action: ActionConfig; model?: string }
  | { type: 'APPEND_STREAM_TOKEN'; token: string }
  | { type: 'STREAM_DONE' }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'SET_STREAM_TEXT'; text: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_PROVIDER'; providerId: string; defaultModel: string }
  | { type: 'SET_THINKING_MODE'; mode: 'quick' | 'deep' }
  | { type: 'SET_CURRENT_SESSION_ID'; sessionId: string | null }
  | { type: 'SET_PINNED'; isPinned: boolean }
  | { type: 'SET_CLOSING'; isClosing: boolean }
  | { type: 'HIDE_COMPLETE' }
  | { type: 'INCREMENT_ANIM_KEY' }
  | { type: 'NEW_CHAT' }
  | { type: 'RESET_STATE' };

export function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case 'SELECTION_TRIGGERED':
      return {
        ...state,
        visible: true,
        selectedText: action.text,
        mode: 'bubble',
        streamText: '',
        error: null,
        isLoading: false,
        isPinned: state.isPinned, // 记忆并保留钉住偏好（气泡态允许新划词刷新）
        isClosing: false,
        animKey: state.animKey + 1,
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
      };

    case 'START_ACTION':
      return {
        ...state,
        visible: true,
        activeAction: action.action,
        mode: 'card',
        streamText: '',
        error: null,
        isLoading: true,
        selectedModel: action.model || state.selectedModel,
      };

    case 'START_EMPTY_CARD_ACTION':
      return {
        ...state,
        visible: true,
        activeAction: action.action,
        mode: 'card',
        selectedText: '',
        streamText: '',
        error: null,
        isLoading: false,
        currentSessionId: null,
        selectedModel: action.model || state.selectedModel,
      };

    case 'APPEND_STREAM_TOKEN':
      return {
        ...state,
        streamText: state.streamText + action.token,
      };

    case 'STREAM_DONE':
      return {
        ...state,
        isLoading: false,
      };

    case 'STREAM_ERROR':
      return {
        ...state,
        error: action.error,
        isLoading: false,
      };

    case 'SET_STREAM_TEXT':
      return {
        ...state,
        streamText: action.text,
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
      };

    case 'SET_MODEL':
      return {
        ...state,
        selectedModel: action.model,
      };

    case 'SET_PROVIDER':
      return {
        ...state,
        activeAction: state.activeAction
          ? { ...state.activeAction, providerId: action.providerId }
          : null,
        selectedModel: action.defaultModel,
      };

    case 'SET_THINKING_MODE':
      return {
        ...state,
        thinkingMode: action.mode,
      };

    case 'SET_CURRENT_SESSION_ID':
      return {
        ...state,
        currentSessionId: action.sessionId,
      };

    case 'SET_PINNED':
      try {
        localStorage.setItem('iox_overlay_pinned', String(action.isPinned));
      } catch {}
      return {
        ...state,
        isPinned: action.isPinned,
      };

    case 'SET_CLOSING':
      return {
        ...state,
        isClosing: action.isClosing,
      };

    case 'HIDE_COMPLETE':
      return {
        ...state,
        visible: false,
        isClosing: false,
        activeAction: null,
        isPinned: state.isPinned, // 隐藏仅结束窗口会话，钉住偏好保留记忆
      };

    case 'INCREMENT_ANIM_KEY':
      return {
        ...state,
        animKey: state.animKey + 1,
      };

    case 'NEW_CHAT':
      return {
        ...state,
        streamText: '',
        selectedText: '',
        error: null,
        isLoading: false,
        currentSessionId: null,
      };

    case 'RESET_STATE':
      return {
        ...initialOverlayState,
        isPinned: state.isPinned,
        animKey: state.animKey + 1,
      };

    default:
      return state;
  }
}
