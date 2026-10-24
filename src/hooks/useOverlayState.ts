import { useReducer, useRef, useSyncExternalStore } from 'react';
import type { AppConfig } from '@/types/config';
import { overlayReducer, initialOverlayState } from '@/state/overlayReducer';
import { createConversationWorkspace, type ConversationWorkspace } from '@/conversation/workspace';
import { useOverlayLifecycle } from '@/hooks/useOverlayLifecycle';
import { useSelectionEvents } from '@/hooks/useSelectionEvents';
import { useActionStream } from '@/hooks/useActionStream';
import { useChatSessions } from '@/hooks/useChatSessions';

export type { OverlayMode } from '@/state/overlayReducer';

export function useOverlayState(config: AppConfig | null) {
  const [state, dispatch] = useReducer(overlayReducer, initialOverlayState);
  const workspaceRef = useRef<ConversationWorkspace | null>(null);
  if (!workspaceRef.current) workspaceRef.current = createConversationWorkspace();
  const workspace = workspaceRef.current;
  const snapshot = useSyncExternalStore(workspace.subscribe, workspace.getSnapshot);
  const conversation = snapshot.active;

  const { updateWindowSize, handleResetCardSize, executeGracefulHide, cancelCloseTimer,
    handlePinToggle, handleClose } = useOverlayLifecycle({
    actions: config?.actions, iconOnly: config?.general.iconOnlyBubble, apiCard: config?.apiCard,
    isPinned: state.isPinned,
    setIsPinned: (isPinned) => dispatch({ type: 'SET_PINNED', isPinned }),
    setIsClosing: (isClosing) => dispatch({ type: 'SET_CLOSING', isClosing }),
    onHideComplete: () => { workspace.reset(); dispatch({ type: 'HIDE_COMPLETE' }); },
    onHideStart: () => stream.handleDetachStream(),
  });
  const stream = useActionStream({ config, workspace, selectionText: state.selectedText,
    isPinned: state.isPinned, onShowCard: () => dispatch({ type: 'SHOW_CARD' }),
    updateWindowSize, executeGracefulHide });
  useSelectionEvents({
    isPinned: state.isPinned,
    onSelectionTriggered: (text) => {
      stream.handleDetachStream(); workspace.reset(); dispatch({ type: 'SELECTION_TRIGGERED', text });
    },
    onFilesSelected: (files, dragId, layout) => {
      stream.handleDetachStream(); workspace.reset(); dispatch({ type: 'FILES_SELECTED', files, dragId, layout });
    },
    onRequestHide: executeGracefulHide, cancelCloseTimer, updateWindowSize,
  });
  const chatSessions = useChatSessions({ workspace, actions: config?.actions ?? [],
    onNavigation: stream.handleDetachStream, onNewSession: stream.handleNewChat });

  return {
    ...state, ...stream, conversation, chatSessions,
    activeTabId: snapshot.activeId,
    tabs: snapshot.tabs.map((tab) => ({ id: tab.id, title: tab.title, isLoading: Boolean(tab.generation) })),
    // 视图只读取结构化投影，旧版 streamText 编码不再出现在渲染路径上。
    selectedText: state.mode === 'card' && conversation ? conversation.selectedText : state.selectedText,
    handleClose, handlePinToggle, handleResetCardSize, updateWindowSize,
  };
}
