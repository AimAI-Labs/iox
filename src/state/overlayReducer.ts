import { ActionConfig } from '@/types/config';

export type OverlayMode = 'bubble' | 'card';

export interface OverlayState {
  mode: OverlayMode;
  selectedText: string;
  activeAction: ActionConfig | null;
  selectedModel: string;
  streamText: string;
  isLoading: boolean;
  isPinned: boolean;
  error: string | null;
  isClosing: boolean;
  animKey: number;
}

export const initialOverlayState: OverlayState = {
  mode: 'bubble',
  selectedText: '',
  activeAction: null,
  selectedModel: '',
  streamText: '',
  isLoading: false,
  isPinned: false,
  error: null,
  isClosing: false,
  animKey: 0,
};

export type OverlayAction =
  | { type: 'SELECTION_TRIGGERED'; text: string }
  | { type: 'SET_MODE'; mode: OverlayMode }
  | { type: 'START_ACTION'; action: ActionConfig; model?: string }
  | { type: 'APPEND_STREAM_TOKEN'; token: string }
  | { type: 'STREAM_DONE' }
  | { type: 'STREAM_ERROR'; error: string }
  | { type: 'SET_STREAM_TEXT'; text: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_PINNED'; isPinned: boolean }
  | { type: 'SET_CLOSING'; isClosing: boolean }
  | { type: 'INCREMENT_ANIM_KEY' }
  | { type: 'RESET_STATE' };

export function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case 'SELECTION_TRIGGERED':
      return {
        ...state,
        selectedText: action.text,
        mode: 'bubble',
        streamText: '',
        error: null,
        isLoading: false,
        isPinned: false,
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
        activeAction: action.action,
        mode: 'card',
        streamText: '',
        error: null,
        isLoading: true,
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

    case 'SET_PINNED':
      return {
        ...state,
        isPinned: action.isPinned,
      };

    case 'SET_CLOSING':
      return {
        ...state,
        isClosing: action.isClosing,
      };

    case 'INCREMENT_ANIM_KEY':
      return {
        ...state,
        animKey: state.animKey + 1,
      };

    case 'RESET_STATE':
      return {
        ...initialOverlayState,
        animKey: state.animKey + 1,
      };

    default:
      return state;
  }
}
