import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ExternalLink, GripVertical, Maximize2, Menu, MessagesSquare, Minus, Move, Pin, RotateCw, Settings, X } from 'lucide-react';
import { DynamicIcon } from '@/components/Icons';
import { useTranslation } from '@/hooks/useTranslation';
import { DEFAULT_WEB_DRAG_HOLD_DELAY_MS, MAX_WEB_HEADLESS_BAR_WIDTH, MIN_WEB_HEADLESS_BAR_WIDTH, type ActionConfig, type WebHubState, type WebMenuActionId } from '@/types/config';
import type { WebMenuChange, WebMenuLayout } from '@/lib/webChromeClient';
import { useWebWheel } from '@/hooks/useWebWheel';
import { WebMenuAction, type WebMenuOperation } from './WebMenuAction';
import { WebQuickWheel } from './WebQuickWheel';
import { WebWindowIcon } from './WebWindowIcon';
import { actionForWebWindow } from './WebFrame';
import './WebFloatingMenu.css';

interface WebFloatingMenuProps {
  windowLabel: string;
  title: string;
  actions: ActionConfig[];
  layout: WebMenuLayout;
  bar: boolean;
  update: (changes: WebMenuChange) => Promise<boolean>;
  failed: boolean;
  errorMessage?: string;
  dragHoldDelayMs: number;
  pinnedActions: WebMenuActionId[];
}

/** Slightly longer than the 160ms fold animation so the commit never cuts the exit short. */
const MENU_FOLD_MS = 180;
const MENU_BUTTON_SIZE = 44;

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function WebFloatingMenu({ windowLabel, title, actions, layout, bar, update, failed, errorMessage, dragHoldDelayMs, pinnedActions }: WebFloatingMenuProps) {
  const { t } = useTranslation();
  const hub = windowLabel === 'web_hub';
  const [hubState, setHubState] = useState<WebHubState>({ tabs: [], activeTabId: null });
  const [actionFailed, setActionFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pinning, setPinning] = useState<WebMenuActionId | null>(null);
  const pinBusy = useRef(false);
  // Native collapses the toolbar in one frame, so the panel plays its own exit first and commits
  // the layout afterwards. A pending close is reversible while native is still expanded.
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<{ timer: ReturnType<typeof setTimeout>; waiters: ((accepted: boolean) => void)[] } | null>(null);
  // The bar is already a navigation surface, so the circular hover wheel is unavailable there.
  const wheel = useWebWheel(layout, update, !bar && pinnedActions.length > 0, closing);
  const [holdingDelayMs, setHoldingDelayMs] = useState<number | null>(null);
  // Follow settings until this toolbar explicitly overrides its own drag mode.
  const [directDragOverride, setDirectDragOverride] = useState<boolean | null>(null);
  // In bar mode the policy is fixed: a plain drag moves the card, a completed hold moves the bar.
  const directDrag = bar || (directDragOverride ?? (dragHoldDelayMs === 0));
  const holdDelayMs = dragHoldDelayMs || DEFAULT_WEB_DRAG_HOLD_DELAY_MS;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ignoreClick = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
    moved: boolean;
    windowDragging: boolean;
    windowDragOnMove: boolean;
    heldForMenu: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const resizeRef = useRef<{
    pointerId: number; startX: number; startWidth: number; width: number; moved: boolean;
  } | null>(null);

  const settleClose = useCallback(() => {
    const pending = closeRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    closeRef.current = null;
    setClosing(false);
    pending.waiters.forEach((resolve) => resolve(true));
  }, []);

  const collapseMenu = useCallback((): Promise<boolean> => {
    const pending = closeRef.current;
    if (pending) return new Promise((resolve) => pending.waiters.push(resolve));
    if (!layoutRef.current.expanded) return Promise.resolve(true);
    if (prefersReducedMotion()) return update({ expanded: false });
    return new Promise((resolve) => {
      setClosing(true);
      closeRef.current = {
        timer: setTimeout(() => {
          closeRef.current = null;
          setClosing(false);
          void update({ expanded: false }).then(resolve);
        }, MENU_FOLD_MS),
        waiters: [resolve],
      };
    });
  }, [update]);

  const cancelPress = () => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.timer !== null) clearTimeout(drag.timer);
    ignoreClick.current = true;
    dragRef.current = null;
    setHoldingDelayMs(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelPress();
    };
    window.addEventListener('blur', cancelPress);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('blur', cancelPress);
      window.removeEventListener('keydown', onKeyDown);
      if (dragRef.current?.timer != null) clearTimeout(dragRef.current.timer);
      dragRef.current = null;
      if (closeRef.current) clearTimeout(closeRef.current.timer);
      closeRef.current = null;
    };
  }, []);

  // An external collapse (native layout or config) already ended the exit phase.
  useEffect(() => {
    if (layout.expanded) return;
    settleClose();
  }, [layout.expanded, settleClose]);

  useEffect(() => {
    if (!hub) return;
    let disposed = false;
    let events = 0;
    let cleanup: (() => void) | undefined;
    void listen<WebHubState>('web_hub_state_changed', (event) => {
      events++;
      if (!disposed) setHubState(event.payload);
    }).then(async (unlisten) => {
      if (disposed) { unlisten(); return; }
      cleanup = unlisten;
      const beforeRead = events;
      const state = await invoke<WebHubState>('get_web_hub_state');
      if (!disposed && events === beforeRead) setHubState(state);
    }).catch(() => { if (!disposed) setActionFailed(true); });
    return () => { disposed = true; cleanup?.(); };
  }, [hub]);

  useEffect(() => {
    if (!layout.expanded && !layout.wheel) return;
    const collapse = () => { void collapseMenu(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        collapse();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', collapse);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', collapse);
    };
  }, [layout.expanded, layout.wheel, collapseMenu]);

  const startWindowDrag = (drag: NonNullable<typeof dragRef.current>, target: HTMLButtonElement) => {
    if (drag.timer !== null) {
      clearTimeout(drag.timer);
      drag.timer = null;
    }
    drag.windowDragging = true;
    ignoreClick.current = true;
    setHoldingDelayMs(null);
    // Transfer capture to the native window while the primary button is still held.
    if (target.hasPointerCapture(drag.pointerId)) target.releasePointerCapture(drag.pointerId);
    void (async () => {
      try {
        await getCurrentWindow().startDragging();
      } catch {
        setActionFailed(true);
        void update({ expanded: true });
      } finally {
        if (dragRef.current === drag) dragRef.current = null;
      }
    })();
  };

  const pointerDown = (event: PointerEvent<HTMLButtonElement>, barDrag = false) => {
    if (event.button !== 0) return;
    wheel.suspend();
    cancelPress();
    event.preventDefault();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    target.focus();
    target.setPointerCapture(pointerId);
    ignoreClick.current = false;
    // On the bar, any blank area moves the bar directly; the menu button keeps the hold policy.
    const isBarDrag = barDrag && bar;
    const canDrag = !layoutRef.current.expanded && (target === triggerRef.current || isBarDrag);
    // A plain drag and a completed hold target opposite surfaces: by default the drag moves the menu
    // and the hold moves the window; direct drag swaps them, so the drag moves the window and the
    // hold moves the menu. The mode is fixed for the whole press.
    const drag = {
      pointerId, x: event.screenX, y: event.screenY,
      originX: layoutRef.current.x + (canDrag ? layoutRef.current.buttonX ?? 0 : 0),
      originY: layoutRef.current.y + (canDrag ? layoutRef.current.buttonY ?? 0 : 0),
      moved: false, windowDragging: false, heldForMenu: false,
      timer: null as ReturnType<typeof setTimeout> | null,
      windowDragOnMove: canDrag && directDrag,
    };
    dragRef.current = drag;
    if (!canDrag) return;
    // Every collapsed bar control shares the hold: after it fires, dragging moves the bar.
    setHoldingDelayMs(holdDelayMs);
    drag.timer = setTimeout(() => {
      if (dragRef.current !== drag || drag.moved) return;
      drag.timer = null;
      if (directDrag) drag.heldForMenu = true;
      else startWindowDrag(drag, target);
    }, holdDelayMs);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.windowDragging) return;
    // Client coordinates change when the native child moves; screen coordinates stay stable.
    const dx = event.screenX - drag.x;
    const dy = event.screenY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    if (drag.windowDragOnMove && !drag.heldForMenu) {
      startWindowDrag(drag, event.currentTarget);
      return;
    }
    if (drag.timer !== null) clearTimeout(drag.timer);
    drag.timer = null;
    setHoldingDelayMs(null);
    const changes: WebMenuChange = { wheel: false, position: [drag.originX + dx, drag.originY + dy] };
    // Keep a manually resized width stable while the whole bar is being repositioned.
    if (bar) changes.barWidth = layoutRef.current.width;
    void update(changes);
  };
  const pointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const drag = dragRef.current;
    if (drag.timer !== null) clearTimeout(drag.timer);
    ignoreClick.current = drag.moved || drag.windowDragging || drag.heldForMenu || event.type === 'pointercancel';
    dragRef.current = null;
    setHoldingDelayMs(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const dragHandlers = {
    onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerEnd, onPointerCancel: pointerEnd,
    onLostPointerCapture: (event: PointerEvent<HTMLButtonElement>) => {
      if (dragRef.current?.pointerId === event.pointerId && !dragRef.current.windowDragging) cancelPress();
    },
  };
  const barDragHandlers = {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => pointerDown(event, true),
    onPointerMove: pointerMove, onPointerUp: pointerEnd, onPointerCancel: pointerEnd,
    onLostPointerCapture: dragHandlers.onLostPointerCapture,
  };
  const openMenu = () => {
    if (ignoreClick.current) { ignoreClick.current = false; return; }
    wheel.suspend();
    // A press during the exit reverses it instead of queueing another collapse.
    if (closeRef.current) { settleClose(); return; }
    if (layoutRef.current.expanded) { void collapseMenu(); return; }
    void update({ expanded: true });
  };
  const runBarAction = (operation: WebMenuOperation) => {
    if (ignoreClick.current) { ignoreClick.current = false; return; }
    // A plain drag already moves the card; the legacy moveWindow action would re-enter it.
    if (operation.id !== 'moveWindow') operation.run();
  };
  const resizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || layoutRef.current.expanded) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.focus();
    target.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId, startX: event.screenX,
      startWidth: layoutRef.current.width, width: layoutRef.current.width, moved: false,
    };
  };
  const resizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    // The bar is anchored on its right edge, so dragging the left grip leftwards widens it.
    const dx = event.screenX - resize.startX;
    if (!resize.moved && Math.abs(dx) < 2) return;
    resize.moved = true;
    resize.width = Math.min(MAX_WEB_HEADLESS_BAR_WIDTH,
      Math.max(MIN_WEB_HEADLESS_BAR_WIDTH, resize.startWidth - dx));
    void update({ barWidth: resize.width });
  };
  const commitBarWidth = (width: number) => {
    void invoke('set_web_headless_bar_width', { width }).catch(() => {
      setActionFailed(true);
      void update({ expanded: true });
    });
  };
  const resizePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (resize.moved) commitBarWidth(Math.round(resize.width));
  };
  const resizeHandlers = {
    onPointerDown: resizePointerDown, onPointerMove: resizePointerMove,
    onPointerUp: resizePointerEnd, onPointerCancel: resizePointerEnd,
    onDoubleClick: () => commitBarWidth(0),
  };

  const perform = async (operation: () => Promise<unknown>, collapse = true) => {
    setActionFailed(false);
    try {
      if (collapse) await collapseMenu();
      await operation();
    } catch {
      setActionFailed(true);
      // Keep failures visible even when an operation was launched from a collapsed menu.
      void update({ expanded: true });
    }
  };
  const reload = () => perform(async () => {
    setRefreshing(true);
    try {
      await (hub ? invoke('reload_web_hub_active_tab') : invoke('reload_web_webview', { contentLabel: `${windowLabel}_web` }));
    } finally { setRefreshing(false); }
  }, false);
  const currentIndex = hubState.tabs.findIndex((tab) => tab.actionId === hubState.activeTabId);
  const activeTab = hubState.tabs[currentIndex];
  const activeAction = hub ? actions.find((action) => action.id === activeTab?.actionId)
    : actionForWebWindow(actions, windowLabel);
  const activeTitle = hubState.tabs[currentIndex]?.name ?? title;
  const available = actions.filter((action) => action.enabled && action.actionType === 'web'
    && !hubState.tabs.some((tab) => tab.actionId === action.id));
  const closeTabs = (ids: string[]) => perform(async () => {
    for (const actionId of ids) await invoke('close_web_hub_tab', { actionId });
  }, false);
  const togglePin = async (id: WebMenuActionId) => {
    if (pinBusy.current) return;
    pinBusy.current = true;
    setPinning(id);
    setActionFailed(false);
    try {
      await invoke('set_web_menu_action_pinned', { actionId: id, pinned: !pinnedActions.includes(id) });
    } catch {
      setActionFailed(true);
      void update({ expanded: true });
    } finally {
      pinBusy.current = false;
      setPinning(null);
    }
  };
  const operations: WebMenuOperation[] = [
    { id: 'reload', label: t('settings.web.menu.reload'), icon: <RotateCw size={14} className={refreshing ? 'animate-spin' : undefined} />, run: () => { void reload(); }, disabled: refreshing },
    { id: 'openExternal', label: t('settings.web.menu.openExternal'), icon: <ExternalLink size={14} />, run: () => { void perform(() => invoke('open_web_page_in_browser')); } },
    { id: 'history', label: t('settings.web.menu.history'), icon: <MessagesSquare size={14} />, run: () => { void perform(() => invoke('show_main_window', { targetTab: 'web_sessions' })); } },
    { id: 'settings', label: t('settings.web.menu.settings'), icon: <Settings size={14} />, run: () => { void perform(() => invoke('show_main_window', { targetTab: 'web' })); } },
    { id: 'moveWindow', label: t('settings.web.menu.moveWindow'), icon: <Move size={14} />, run: () => { wheel.suspend(); void perform(() => getCurrentWindow().startDragging(), false); } },
    { id: 'minimize', label: t('settings.web.menu.minimize'), icon: <Minus size={14} />, run: () => { void perform(() => invoke('minimize_web_window', { label: windowLabel })); } },
    { id: 'maximize', label: t('settings.web.menu.maximize'), icon: <Maximize2 size={14} />, run: () => { void perform(() => invoke('toggle_maximize_web_window', { label: windowLabel })); } },
    { id: 'closeWindow', label: t('settings.web.menu.closeWindow'), icon: <X size={14} />, run: () => { void perform(() => invoke('close_web_window', { label: windowLabel })); }, danger: true },
  ];
  const openLabel = directDrag ? t('settings.web.menu.openImmediate', { delay: holdDelayMs })
    : t('settings.web.menu.open', { delay: holdDelayMs });
  const triggerLabel = layout.expanded ? t('settings.web.menu.collapse')
    : bar ? t('settings.web.menu.openBarImmediate', { delay: holdDelayMs }) : openLabel;
  const TriggerIcon = directDrag && !bar ? Move : Menu;
  // The panel unfolds from, and folds back into, the collapsed button or bar rectangle.
  const foldLeft = bar ? 0 : layout.buttonX;
  const foldWidth = bar ? layout.width : MENU_BUTTON_SIZE;
  const foldStyle = {
    '--web-fold-top': `${layout.buttonY}px`,
    '--web-fold-right': `${Math.max(0, layout.width - foldLeft - foldWidth)}px`,
    '--web-fold-bottom': `${Math.max(0, layout.height - layout.buttonY - MENU_BUTTON_SIZE)}px`,
    '--web-fold-left': `${foldLeft}px`,
  } as CSSProperties;

  return (
    <div className="web-floating-menu" data-expanded={layout.expanded} data-bar={bar} data-closing={closing}
      data-wheel={!bar && layout.wheel} data-wheel-closing={wheel.closing}
      data-upward={layout.expanded && layout.buttonY > 0} style={foldStyle}
      onPointerEnter={wheel.enter} onPointerLeave={wheel.leave}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) wheel.leave(); }}
      role={layout.expanded ? 'dialog' : undefined} aria-label={t('settings.web.menu.title')}>
      <WebWindowIcon icon={activeAction?.icon ?? activeTab?.icon} actionId={activeAction?.id ?? activeTab?.actionId} />
      <header className="web-menu-header" data-holding={holdingDelayMs !== null}
        style={!layout.expanded ? {
          left: bar ? 0 : layout.buttonX, top: layout.buttonY,
          ...(bar ? { '--web-hold-delay': `${holdDelayMs}ms` } : {}),
        } as CSSProperties : undefined}>
        {bar && !layout.expanded && <>
          <button type="button" className="web-menu-bar-resize"
            aria-label={t('settings.web.menu.resizeBar')} {...resizeHandlers} />
          <button type="button" className="web-menu-bar-drag"
            aria-label={t('settings.web.menu.openBarImmediate', { delay: holdDelayMs })}
            {...barDragHandlers} onClick={openMenu} />
          <div className="web-menu-bar-actions">
            {pinnedActions.flatMap((id) => operations.find((operation) => operation.id === id) ?? [])
              .map((operation) => <button key={operation.id} type="button" className="web-menu-bar-action"
                data-danger={operation.danger || undefined} disabled={operation.disabled}
                aria-label={operation.label} {...barDragHandlers}
                onClick={() => runBarAction(operation)}>{operation.icon}</button>)}
          </div>
        </>}
        {layout.expanded && <>
          <button type="button" className="web-menu-grip" aria-label={t('settings.web.menu.drag')} {...dragHandlers}>
            <GripVertical size={15} aria-hidden="true" />
            <span className="web-menu-title">{activeTitle}</span>
          </button>
          {!bar && <button type="button" className="web-menu-drag-toggle" aria-pressed={directDrag}
            aria-label={t('settings.web.menu.directDrag')}
            onClick={() => { cancelPress(); setDirectDragOverride(!directDrag); }}>
            <Move size={15} />
          </button>}
        </>}
        <button type="button" ref={triggerRef} className="web-menu-trigger" aria-expanded={layout.expanded} data-holding={holdingDelayMs !== null}
          data-window-drag={directDrag}
          style={{ '--web-hold-delay': `${holdingDelayMs ?? dragHoldDelayMs}ms` } as CSSProperties}
          aria-controls="web-floating-menu-actions" aria-label={triggerLabel}
          {...dragHandlers} onClick={openMenu}>
          <span className="web-menu-trigger-surface" aria-hidden="true">
            <span className="web-menu-trigger-glyph">{layout.expanded ? <X size={16} /> : <TriggerIcon size={18} />}</span>
          </span>
        </button>
      </header>
      {!bar && layout.wheel && <WebQuickWheel layout={layout} closing={wheel.closing}
        operations={pinnedActions.flatMap((id) => operations.find((operation) => operation.id === id) ?? [])}
        dismiss={wheel.dismiss} />}
      {layout.expanded && <div id="web-floating-menu-actions" className="web-menu-body">
        {(failed || actionFailed || errorMessage) && <p className="web-menu-error" role="alert">{errorMessage || t('settings.web.menu.failed')}</p>}
        {hub && <section className="web-menu-tabs" aria-label={t('settings.web.menu.tabs')}>
          <p className="web-menu-section-title">{t('settings.web.menu.tabs')} <span>{hubState.tabs.length}</span></p>
          <div className="web-menu-tab-list">
            {hubState.tabs.map((tab) => <div key={tab.actionId} className="web-menu-tab" data-active={tab.actionId === hubState.activeTabId}>
              <button type="button" aria-pressed={tab.actionId === hubState.activeTabId}
                onClick={() => void perform(() => invoke('switch_web_hub_tab', { actionId: tab.actionId }), false)}>
                <DynamicIcon name={tab.icon} size={14} /><span>{tab.name}</span>
              </button>
              <button type="button" aria-label={t('settings.web.menu.closeTab', { name: tab.name })}
                onClick={() => void closeTabs([tab.actionId])}><X size={12} /></button>
            </div>)}
          </div>
          <select className="web-menu-new-tab" value="" aria-label={t('settings.web.menu.openTab')}
            disabled={available.length === 0} onChange={(event) => {
              const actionId = event.target.value;
              if (actionId) void perform(() => invoke('trigger_web_action', { actionId, text: '', copyToClipboard: false }), false);
            }}>
            <option value="">{t('settings.web.menu.openTab')}</option>
            {available.map((action) => <option value={action.id} key={action.id}>{action.name}</option>)}
          </select>
          <div className="web-menu-batch">
            <button type="button" disabled={hubState.tabs.length <= 1} onClick={() => void closeTabs(hubState.tabs.filter((tab) => tab.actionId !== hubState.activeTabId).map((tab) => tab.actionId))}>{t('settings.web.menu.closeOthers')}</button>
            <button type="button" disabled={currentIndex <= 0} onClick={() => void closeTabs(hubState.tabs.slice(0, currentIndex).map((tab) => tab.actionId))}>{t('settings.web.menu.closeLeft')}</button>
            <button type="button" disabled={currentIndex < 0 || currentIndex >= hubState.tabs.length - 1} onClick={() => void closeTabs(hubState.tabs.slice(currentIndex + 1).map((tab) => tab.actionId))}>{t('settings.web.menu.closeRight')}</button>
          </div>
        </section>}
        {operations.map((operation) => <Fragment key={operation.id}>
          {operation.id === 'moveWindow' && <div className="web-menu-separator" />}
          <div className="web-menu-action-row" data-action-id={operation.id}>
            <WebMenuAction operation={operation} />
            <button type="button" className="web-menu-pin" aria-pressed={pinnedActions.includes(operation.id)}
              disabled={pinning !== null}
              aria-label={t(pinnedActions.includes(operation.id) ? 'settings.web.menu.unpin' : 'settings.web.menu.pin', { name: operation.label })}
              onClick={() => { void togglePin(operation.id); }}><Pin size={12} /></button>
          </div>
        </Fragment>)}
      </div>}
    </div>
  );
}
