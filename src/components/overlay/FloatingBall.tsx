import React, { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { ActionConfig, AppConfig } from '@/types/config';
import { IOXLogo } from '@/components/common';
import { FloatingMenu, type FloatingMenuCorner } from './FloatingMenu';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from '@/hooks/useTranslation';

export interface FloatingBallProps {
  config: AppConfig | null;
}

type Timer = ReturnType<typeof setTimeout>;
type DockedEdge = 'left' | 'right' | 'none';
type BallPosition = [number, number, FloatingMenuCorner, DockedEdge];
interface CloseOptions { immediate?: boolean; reversible?: boolean }
interface ClosingTransition {
  promise: Promise<boolean>;
  resolve: (closed: boolean) => void;
  reversible: boolean;
  committing: boolean;
  finish: () => Promise<void>;
}
function cancelTimer(ref: { current: Timer | null }) {
  if (ref.current !== null) clearTimeout(ref.current);
  ref.current = null;
}

export const FloatingBall: React.FC<FloatingBallProps> = ({ config }) => {
  const { t } = useTranslation();
  const [edge, setEdge] = useState<DockedEdge>('right');
  const dockedEdge = useRef<DockedEdge>('right');
  const [corner, setCorner] = useState<FloatingMenuCorner>('top-right');
  const [isIdle, setIsIdle] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [capturedText, setCapturedText] = useState('');
  const idleTimer = useRef<Timer | null>(null);
  const hoverTimer = useRef<Timer | null>(null);
  const leaveTimer = useRef<Timer | null>(null);
  const closeTimer = useRef<Timer | null>(null);
  const closing = useRef<ClosingTransition | null>(null);
  const inside = useRef(false);
  const expanded = useRef(false);
  const opening = useRef(false);
  const inputFocused = useRef(false);
  const dragging = useRef(false);
  const mouseDown = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const generation = useRef(0);
  const nativeQueue = useRef<Promise<unknown>>(Promise.resolve());
  const hideDelayMs = Math.min(10000, Math.max(500, config?.general.floatingBallHideDelayMs ?? 2500));
  const hoverDelayMs = Math.min(3000, Math.max(100, config?.general.floatingBallHoverDelayMs ?? 220));

  const resetIdleTimer = useCallback(() => {
    cancelTimer(idleTimer);
    setIsIdle(false);
    if (dockedEdge.current !== 'none' && (config?.general.floatingBallAutoHide ?? true) && !expanded.current && !opening.current && !dragging.current && !inside.current) {
      idleTimer.current = setTimeout(() => setIsIdle(true), hideDelayMs);
    }
  }, [config?.general.floatingBallAutoHide, hideDelayMs, edge]);

  const commitPlacement = useCallback((next: FloatingMenuCorner, dock: DockedEdge = 'none') => {
    dockedEdge.current = dock;
    if (dock === 'none') cancelTimer(idleTimer);
    flushSync(() => {
      setCorner(next);
      setEdge(dock);
      setIsIdle(false);
    });
  }, []);

  useEffect(() => {
    if (config?.general.enableFloatingBall === false) return;
    nativeQueue.current = invoke<BallPosition>('init_floating_ball')
      .then(async (result) => {
        commitPlacement(result[2], result[3]);
        await invoke('set_floating_ball_expanded', { expanded: false });
      })
      .catch((error) => console.error('Failed to init floating ball:', error));
    return () => {
      generation.current++;
      cancelTimer(idleTimer);
      cancelTimer(hoverTimer);
      cancelTimer(leaveTimer);
      cancelTimer(closeTimer);
      closing.current?.resolve(false);
      closing.current = null;
    };
  }, [config?.general.enableFloatingBall, commitPlacement]);

  useEffect(() => {
    resetIdleTimer();
    return () => cancelTimer(idleTimer);
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!isExpanded || isClosing) return;
    const request = generation.current;
    let secondFrame = 0;
    // Paint the anchored circle before changing the transition's target.
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (request === generation.current) setIsRevealed(true);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [isExpanded, isClosing]);

  useEffect(() => {
    const release = () => { mouseDown.current = false; };
    window.addEventListener('mouseup', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('mouseup', release);
      window.removeEventListener('blur', release);
    };
  }, []);

  // Serialize input-region changes so a late expansion cannot undo a close.
  const setMenuRegion = useCallback((open: boolean) => {
    const task = nativeQueue.current.then(async () => {
      if (!open) {
        // The canvas stays full-size; remove the glass after its exit animation
        // before restricting native input to the ball.
        flushSync(() => {
          setIsExpanded(false);
          setIsRevealed(false);
          setIsClosing(false);
        });
      }
      const result = await invoke<[number, number, FloatingMenuCorner]>('set_floating_ball_expanded', {
        expanded: open,
      });
      return result;
    });
    nativeQueue.current = task.catch(() => undefined);
    return task;
  }, []);

  const openMenu = useCallback(async () => {
    if (closing.current || expanded.current || opening.current || dragging.current || mouseDown.current) return;
    const request = ++generation.current;
    opening.current = true;
    setIsIdle(false);
    try {
      const result = await setMenuRegion(true);
      if (request !== generation.current) return;
      opening.current = false;
      expanded.current = true;
      setCorner(result[2]);
      setIsExpanded(true);
      setIsClosing(false);
      setIsRevealed(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      // Display immediately; clipboard polling must not delay hover feedback.
      void invoke<string | null>('get_current_selection').then((selected) => {
        if (request === generation.current && expanded.current) setCapturedText(selected?.trim() || '');
      }).catch((error) => console.error('Failed to capture selection:', error));
    } catch (error) {
      if (request === generation.current) opening.current = false;
      console.error('Failed to expand floating menu:', error);
    }
  }, [setMenuRegion]);

  const scheduleHover = useCallback(() => {
    cancelTimer(hoverTimer);
    if (!closing.current && !expanded.current && !opening.current && !dragging.current && !mouseDown.current) {
      hoverTimer.current = setTimeout(() => { void openMenu(); }, hoverDelayMs);
    }
  }, [openMenu, hoverDelayMs]);

  useEffect(() => {
    if (inside.current) scheduleHover();
    return () => cancelTimer(hoverTimer);
  }, [scheduleHover]);

  const closeMenu = useCallback((options: CloseOptions = {}): Promise<boolean> => {
    cancelTimer(hoverTimer);
    cancelTimer(leaveTimer);
    const pending = closing.current;
    if (pending) {
      if (!options.reversible) pending.reversible = false;
      if (options.immediate && !pending.committing) {
        cancelTimer(closeTimer);
        void pending.finish();
      }
      return pending.promise;
    }
    if (!expanded.current && !opening.current) return Promise.resolve(true);

    const request = ++generation.current;
    let resolve!: (closed: boolean) => void;
    const promise = new Promise<boolean>((done) => { resolve = done; });
    const transition: ClosingTransition = {
      promise, resolve, reversible: Boolean(options.reversible), committing: false,
      finish: async () => {
        transition.committing = true;
        expanded.current = false;
        opening.current = false;
        inputFocused.current = false;
        try {
          await setMenuRegion(false);
          if (request === generation.current) {
            setIsExpanded(false);
            setIsRevealed(false);
            setIsClosing(false);
            setCapturedText('');
          }
          resolve(true);
        } catch (error) {
          if (request === generation.current) {
            expanded.current = true;
            setIsExpanded(true);
            setIsClosing(false);
            setIsRevealed(true);
          }
          console.error('Failed to collapse floating menu:', error);
          resolve(false);
        } finally {
          if (closing.current === transition) closing.current = null;
          if (request === generation.current) {
            resetIdleTimer();
            if (transition.reversible && inside.current) scheduleHover();
          }
        }
      },
    };
    closing.current = transition;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (options.immediate || reduceMotion || !expanded.current) {
      void transition.finish();
    } else {
      setIsClosing(true);
      setIsRevealed(false);
      // Keep the native canvas until the 180ms visual return has finished.
      closeTimer.current = setTimeout(() => { void transition.finish(); }, 200);
    }
    return promise;
  }, [setMenuRegion, resetIdleTimer, scheduleHover]);

  useEffect(() => {
    const unsubscribe = listen('floating-ball-dismiss', () => { void closeMenu({ immediate: true }); });
    return () => { void unsubscribe.then((dispose) => dispose()); };
  }, [closeMenu]);

  const scheduleClose = () => {
    cancelTimer(leaveTimer);
    if (!inputFocused.current) leaveTimer.current = setTimeout(() => { void closeMenu({ reversible: true }); }, 300);
  };

  const handleMouseEnter = () => {
    inside.current = true;
    cancelTimer(idleTimer);
    cancelTimer(leaveTimer);
    setIsIdle(false);
    const pending = closing.current;
    if (pending?.reversible && !pending.committing) {
      cancelTimer(closeTimer);
      generation.current++;
      closing.current = null;
      pending.resolve(false);
      setIsClosing(false);
      setIsRevealed(true);
      return;
    }
    scheduleHover();
  };

  const handleMouseLeave = () => {
    inside.current = false;
    cancelTimer(hoverTimer);
    if (opening.current || expanded.current) scheduleClose();
    else resetIdleTimer();
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    mouseDown.current = true;
    dragStart.current = { x: event.screenX, y: event.screenY };
    cancelTimer(hoverTimer);
    cancelTimer(leaveTimer);
    setIsIdle(false);
  };

  const handleMouseMove = async (event: React.MouseEvent) => {
    if (!mouseDown.current || dragging.current) return;
    if (Math.hypot(event.screenX - dragStart.current.x, event.screenY - dragStart.current.y) <= 5) return;
    dragging.current = true;
    mouseDown.current = false;
    inside.current = false;
    try {
      if (!await closeMenu({ immediate: true })) return;
      const result = await invoke<BallPosition>('start_floating_ball_dragging');
      commitPlacement(result[2], result[3]);
      await invoke('set_floating_ball_expanded', { expanded: false });
    } catch (error) {
      console.error('Floating ball drag failed:', error);
    } finally {
      dragging.current = false;
      resetIdleTimer();
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    mouseDown.current = false;
    if (inside.current && !dragging.current) scheduleHover();
  };

  const handleOpenSettings = async () => {
    if (!await closeMenu({ immediate: true })) return;
    try {
      await invoke('show_main_window');
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  };

  const handleTriggerAction = async (action: ActionConfig, customPrompt?: string) => {
    const text = customPrompt || capturedText;
    if (!await closeMenu()) return;
    try {
      await invoke(action.actionType === 'api' ? 'trigger_api_action' : 'trigger_web_action', {
        actionId: action.id, text,
      });
    } catch (error) {
      console.error('Failed to trigger floating ball action:', error);
    }
  };

  const handleInputFocusChange = (focused: boolean) => {
    inputFocused.current = focused;
    cancelTimer(leaveTimer);
    if (!focused && !inside.current && expanded.current && !closing.current) scheduleClose();
  };

  if (!config) return null;

  return (
    <div
      className={cn('floating-ball-container floating-launcher select-none',
        isExpanded && 'is-expanded', isRevealed && 'is-revealed', isClosing && 'is-closing')}
      data-corner={corner}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isExpanded && (
        <FloatingMenu
          config={config}
          selectedText={capturedText}
          corner={corner}
          isClosing={isClosing}
          onClose={() => { void closeMenu(); }}
          onTriggerAction={handleTriggerAction}
          onOpenSettings={handleOpenSettings}
          onInputFocusChange={handleInputFocusChange}
        />
      )}
      <button
        type="button"
        data-testid="floating-ball-trigger"
        className={cn('floating-ball floating-launcher-ball',
          edge === 'left' && 'is-docked-left', edge === 'right' && 'is-docked-right', !isExpanded && isIdle && 'is-idle')}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleOpenSettings}
        aria-label={t('bubble.floatingBallTip')}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? 'floating-action-menu' : undefined}
      >
        <span className="floating-ball-icon pointer-events-none"><IOXLogo size={24} /></span>
      </button>
    </div>
  );
};
