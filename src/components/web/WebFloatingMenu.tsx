import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ExternalLink, GripVertical, Maximize2, Menu, MessagesSquare, Minus, Move, RotateCw, Settings, X } from 'lucide-react';
import { DynamicIcon } from '@/components/Icons';
import { useTranslation } from '@/hooks/useTranslation';
import { DEFAULT_WEB_DRAG_HOLD_DELAY_MS, type ActionConfig, type WebHubState } from '@/types/config';
import type { WebMenuChange, WebMenuLayout } from '@/lib/webChromeClient';
import './WebFloatingMenu.css';

interface WebFloatingMenuProps {
  windowLabel: string;
  title: string;
  actions: ActionConfig[];
  layout: WebMenuLayout;
  update: (changes: WebMenuChange) => Promise<boolean>;
  failed: boolean;
  dragHoldDelayMs: number;
}

export function WebFloatingMenu({ windowLabel, title, actions, layout, update, failed, dragHoldDelayMs }: WebFloatingMenuProps) {
  const { t } = useTranslation();
  const hub = windowLabel === 'web_hub';
  const [hubState, setHubState] = useState<WebHubState>({ tabs: [], activeTabId: null });
  const [actionFailed, setActionFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [holdingDelayMs, setHoldingDelayMs] = useState<number | null>(null);
  // Follow settings until this toolbar explicitly overrides its own drag mode.
  const [directDragOverride, setDirectDragOverride] = useState<boolean | null>(null);
  const directDrag = directDragOverride ?? (dragHoldDelayMs === 0);
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
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

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
    };
  }, []);

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
    if (!layout.expanded) return;
    const collapse = () => { void update({ expanded: false }); };
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
  }, [layout.expanded, update]);

  const startWindowDrag = (drag: NonNullable<typeof dragRef.current>, target: HTMLButtonElement) => {
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

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    cancelPress();
    event.preventDefault();
    const target = event.currentTarget;
    const pointerId = event.pointerId;
    target.focus();
    target.setPointerCapture(pointerId);
    ignoreClick.current = false;
    const canDragWindow = target === triggerRef.current && !layoutRef.current.expanded;
    const drag = {
      pointerId, x: event.screenX, y: event.screenY,
      originX: layoutRef.current.x, originY: layoutRef.current.y,
      moved: false, windowDragging: false, timer: null as ReturnType<typeof setTimeout> | null,
      windowDragOnMove: canDragWindow && directDrag,
    };
    dragRef.current = drag;
    if (canDragWindow && !directDrag) {
      setHoldingDelayMs(holdDelayMs);
      drag.timer = setTimeout(() => {
        if (dragRef.current !== drag || drag.moved) return;
        drag.timer = null;
        startWindowDrag(drag, target);
      }, holdDelayMs);
    }
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.windowDragging) return;
    // Client coordinates change when the native child moves; screen coordinates stay stable.
    const dx = event.screenX - drag.x;
    const dy = event.screenY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    if (drag.windowDragOnMove) {
      startWindowDrag(drag, event.currentTarget);
      return;
    }
    if (drag.timer !== null) clearTimeout(drag.timer);
    drag.timer = null;
    setHoldingDelayMs(null);
    void update({ position: [drag.originX + dx, drag.originY + dy] });
  };
  const pointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    const drag = dragRef.current;
    if (drag.timer !== null) clearTimeout(drag.timer);
    ignoreClick.current = drag.moved || drag.windowDragging || event.type === 'pointercancel';
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

  const perform = async (operation: () => Promise<unknown>, collapse = true) => {
    setActionFailed(false);
    try {
      if (collapse) await update({ expanded: false });
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
  const activeTitle = hubState.tabs[currentIndex]?.name ?? title;
  const available = actions.filter((action) => action.enabled && action.actionType === 'web'
    && !hubState.tabs.some((tab) => tab.actionId === action.id));
  const closeTabs = (ids: string[]) => perform(async () => {
    for (const actionId of ids) await invoke('close_web_hub_tab', { actionId });
  }, false);
  const row = (label: string, icon: ReactNode, onClick: () => void, disabled = false, danger = false) => (
    <button type="button" className="web-menu-action" onClick={onClick} disabled={disabled} data-danger={danger || undefined}>
      {icon}<span>{label}</span>
    </button>
  );
  const openLabel = directDrag ? t('settings.web.menu.openImmediate')
    : t('settings.web.menu.open', { delay: holdDelayMs });
  const triggerLabel = layout.expanded ? t('settings.web.menu.collapse') : openLabel;
  const TriggerIcon = directDrag ? Move : Menu;

  return (
    <div className="web-floating-menu" data-expanded={layout.expanded}
      role={layout.expanded ? 'dialog' : undefined} aria-label={t('settings.web.menu.title')}>
      <header className="web-menu-header">
        {layout.expanded && <>
          <button type="button" className="web-menu-grip" aria-label={t('settings.web.menu.drag')} title={t('settings.web.menu.drag')} {...dragHandlers}>
            <GripVertical size={15} />
          </button>
          <span className="web-menu-title" title={activeTitle}>{activeTitle}</span>
          <button type="button" className="web-menu-drag-toggle" aria-pressed={directDrag}
            aria-label={t('settings.web.menu.directDrag')}
            title={directDrag ? t('settings.web.menu.disableDirectDrag', { delay: holdDelayMs }) : t('settings.web.menu.enableDirectDrag')}
            onClick={() => { cancelPress(); setDirectDragOverride(!directDrag); }}>
            <Move size={15} />
          </button>
        </>}
        <button type="button" ref={triggerRef} className="web-menu-trigger" aria-expanded={layout.expanded} data-holding={holdingDelayMs !== null}
          data-window-drag={directDrag}
          style={{ '--web-hold-delay': `${holdingDelayMs ?? dragHoldDelayMs}ms` } as CSSProperties}
          aria-controls="web-floating-menu-actions" aria-label={triggerLabel} title={triggerLabel}
          {...dragHandlers} onClick={() => {
            if (ignoreClick.current) { ignoreClick.current = false; return; }
            void update({ expanded: !layoutRef.current.expanded });
          }}>
          {layout.expanded ? <X size={16} /> : <TriggerIcon size={18} />}
        </button>
      </header>
      {layout.expanded && <div id="web-floating-menu-actions" className="web-menu-body">
        {(failed || actionFailed) && <p className="web-menu-error" role="alert">{t('settings.web.menu.failed')}</p>}
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
        {row(t('settings.web.menu.reload'), <RotateCw size={14} className={refreshing ? 'animate-spin' : undefined} />, () => void reload(), refreshing)}
        {row(t('settings.web.menu.openExternal'), <ExternalLink size={14} />, () => void perform(() => invoke('open_web_page_in_browser')))}
        {row(t('settings.web.menu.history'), <MessagesSquare size={14} />, () => void perform(() => invoke('show_main_window', { targetTab: 'web_sessions' })))}
        {row(t('settings.web.menu.settings'), <Settings size={14} />, () => void perform(() => invoke('show_main_window', { targetTab: 'web' })))}
        <div className="web-menu-separator" />
        <button type="button" className="web-menu-action" onMouseDown={(event) => {
          if (event.button === 0) void perform(() => getCurrentWindow().startDragging(), false);
        }} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            void perform(() => getCurrentWindow().startDragging(), false);
          }
        }}><Move size={14} /><span>{t('settings.web.menu.moveWindow')}</span></button>
        {row(t('settings.web.menu.minimize'), <Minus size={14} />, () => void perform(() => invoke('minimize_web_window', { label: windowLabel })))}
        {row(t('settings.web.menu.maximize'), <Maximize2 size={14} />, () => void perform(() => invoke('toggle_maximize_web_window', { label: windowLabel })))}
        {row(t('settings.web.menu.closeWindow'), <X size={14} />, () => void perform(() => invoke('close_web_window', { label: windowLabel })), false, true)}
      </div>}
    </div>
  );
}
