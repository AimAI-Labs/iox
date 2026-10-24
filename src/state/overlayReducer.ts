import type { FileMenuLayout } from '@/lib/file-drop';

export type OverlayMode = 'bubble' | 'card';

/** Window state and the bubble's selection buffer. Card conversations live in the workspace. */
export interface OverlayState {
  mode: OverlayMode;
  visible: boolean;
  selectedText: string;
  selectedFiles: string[];
  fileDragId: number | null;
  fileMenuLayout: FileMenuLayout | null;
  isPinned: boolean;
  isClosing: boolean;
  animKey: number;
}

function getInitialPinnedState(): boolean {
  try { return localStorage.getItem('iox_overlay_pinned') === 'true'; }
  catch { return false; }
}
export const initialOverlayState: OverlayState = {
  mode: 'bubble', visible: false, selectedText: '', selectedFiles: [], fileDragId: null,
  fileMenuLayout: null, isPinned: getInitialPinnedState(), isClosing: false, animKey: 0,
};
export type OverlayAction =
  | { type: 'SELECTION_TRIGGERED'; text: string }
  | { type: 'FILES_SELECTED'; files: string[]; dragId: number; layout: FileMenuLayout }
  | { type: 'SHOW_CARD' }
  | { type: 'SET_PINNED'; isPinned: boolean }
  | { type: 'SET_CLOSING'; isClosing: boolean }
  | { type: 'HIDE_COMPLETE' }
  | { type: 'RESET_STATE' };

export function overlayReducer(state: OverlayState, action: OverlayAction): OverlayState {
  switch (action.type) {
    case 'SELECTION_TRIGGERED':
      return { ...initialOverlayState, visible: true, selectedText: action.text,
        isPinned: state.isPinned, animKey: state.animKey + 1 };
    case 'FILES_SELECTED':
      return { ...initialOverlayState, visible: true, selectedFiles: action.files,
        fileDragId: action.dragId, fileMenuLayout: action.layout,
        isPinned: state.isPinned, animKey: state.animKey + 1 };
    case 'SHOW_CARD': return { ...state, visible: true, mode: 'card' };
    case 'SET_PINNED':
      try { localStorage.setItem('iox_overlay_pinned', String(action.isPinned)); } catch {}
      return { ...state, isPinned: action.isPinned };
    case 'SET_CLOSING': return { ...state, isClosing: action.isClosing };
    case 'HIDE_COMPLETE':
      return { ...state, selectedFiles: [], fileDragId: null, fileMenuLayout: null, visible: false, isClosing: false };
    case 'RESET_STATE': return { ...initialOverlayState, isPinned: state.isPinned, animKey: state.animKey + 1 };
    default: return state;
  }
}
