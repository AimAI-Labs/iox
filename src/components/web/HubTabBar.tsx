import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { openUrl } from '@tauri-apps/plugin-opener';
import { MacTrafficLights } from '@/components/MacTrafficLights';
import { DynamicIcon } from '@/components/Icons';
import { WebHubState, AppConfig, ActionConfig } from '@/types/config';
import { RotateCw, ExternalLink, Settings, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const HubTabBar: React.FC = () => {
  const [hubState, setHubState] = useState<WebHubState>({
    tabs: [],
    active_tab_id: null,
  });
  const [actions, setActions] = useState<ActionConfig[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 1. 初始化并监听 WebHub 状态与配置
  useEffect(() => {
    // 读取 Hub 状态
    invoke<WebHubState>('get_web_hub_state')
      .then((state) => {
        if (state) setHubState(state);
      })
      .catch((err) => console.warn('Failed to get web hub state:', err));

    // 读取配置以获取所有启用的 Web 动作
    invoke<AppConfig>('get_config')
      .then((cfg) => {
        if (cfg?.actions) setActions(cfg.actions);
      })
      .catch((err) => console.warn('Failed to get config:', err));

    // 监听 Hub 状态广播
    const unlistenHub = listen<WebHubState>('web_hub_state_changed', (event) => {
      if (event.payload) setHubState(event.payload);
    });

    // 监听配置更新
    const unlistenConfig = listen<AppConfig>('config_updated', (event) => {
      if (event.payload?.actions) setActions(event.payload.actions);
    });

    return () => {
      unlistenHub.then((unsub) => unsub());
      unlistenConfig.then((unsub) => unsub());
    };
  }, []);

  // 点击外部自动关闭 "+" 下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsPlusMenuOpen(false);
      }
    };
    if (isPlusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPlusMenuOpen]);

  // 2. 窗口控制
  const handleClose = async () => {
    try {
      await invoke('close_web_window', { label: 'web_hub' });
    } catch {
      try {
        const win = getCurrentWebviewWindow();
        await win.close();
      } catch (err) {
        console.warn('Failed to close web hub:', err);
      }
    }
  };

  const handleMinimize = async () => {
    try {
      await invoke('minimize_web_window', { label: 'web_hub' });
    } catch {
      try {
        const win = getCurrentWebviewWindow();
        await win.minimize();
      } catch (err) {
        console.warn('Failed to minimize web hub:', err);
      }
    }
  };

  const handleMaximize = async () => {
    try {
      await invoke('toggle_maximize_web_window', { label: 'web_hub' });
    } catch {
      try {
        const win = getCurrentWebviewWindow();
        await win.toggleMaximize();
      } catch (err) {
        console.warn('Failed to toggle maximize web hub:', err);
      }
    }
  };

  const handleMouseDownDrag = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, .traffic-light, input, select, .tab-item, .popover-menu')) {
      return;
    }
    if (e.button === 0) {
      try {
        const win = getCurrentWebviewWindow();
        await win.startDragging();
      } catch (err) {
        console.warn('startDragging failed:', err);
      }
    }
  };

  const handleDoubleClickDrag = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, .traffic-light, input, select, .tab-item, .popover-menu')) {
      return;
    }
    await handleMaximize();
  };

  // 3. Tab 切换与关闭
  const handleSwitchTab = async (actionId: string) => {
    try {
      await invoke('switch_web_hub_tab', { actionId });
    } catch (err) {
      console.warn('Failed to switch tab:', err);
    }
  };

  const handleCloseTab = async (e: React.MouseEvent, actionId: string) => {
    e.stopPropagation();
    try {
      await invoke('close_web_hub_tab', { actionId });
    } catch (err) {
      console.warn('Failed to close tab:', err);
    }
  };

  // 4. 打开新 Tab
  const handleOpenNewTab = async (actionId: string) => {
    setIsPlusMenuOpen(false);
    try {
      await invoke('trigger_web_action', {
        actionId,
        text: '',
        copyToClipboard: false,
      });
    } catch (err) {
      console.warn('Failed to open new tab:', err);
    }
  };

  // 5. 刷新活跃 Tab
  const handleReload = async () => {
    setIsRefreshing(true);
    try {
      await invoke('reload_web_hub_active_tab');
    } catch (err) {
      console.warn('Failed to reload active tab:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // 6. 外部浏览器打开当前活跃 Tab
  const currentActiveTab = hubState.tabs.find((t) => t.action_id === hubState.active_tab_id);
  const handleOpenExternal = async () => {
    if (!currentActiveTab?.url) return;
    try {
      await openUrl(currentActiveTab.url);
    } catch {
      try {
        await invoke('open_in_browser', { url: currentActiveTab.url });
      } catch (err) {
        console.warn('Failed to open external url:', err);
      }
    }
  };

  // 7. 打开设置
  const handleOpenSettings = async () => {
    try {
      await invoke('show_main_window', { targetTab: 'web' });
    } catch (err) {
      console.warn('Failed to open settings window:', err);
    }
  };

  // 过滤出未在 Hub 中打开的已启用 Web 动作
  const openedActionIds = new Set(hubState.tabs.map((t) => t.action_id));
  const availableWebActions = actions.filter(
    (a) => a.actionType === 'web' && a.enabled && !openedActionIds.has(a.id)
  );

  return (
    <div className="web-titlebar-root w-full h-[38px] max-h-[38px] bg-transparent flex items-center justify-center box-border overflow-hidden select-none">
      <header
        className="w-full h-[38px] max-h-[38px] flex items-center justify-between px-3 bg-[var(--bg-overlay-card)] text-foreground rounded-t-xl border-t border-l border-r border-b border-black/10 dark:border-white/10 overflow-hidden backdrop-blur-2xl box-border"
        data-tauri-drag-region
        onMouseDown={handleMouseDownDrag}
        onDoubleClick={handleDoubleClickDrag}
      >
        {/* 左侧：交通灯区域 */}
        <div className="flex items-center gap-2 shrink-0 pr-2 h-full">
          <MacTrafficLights
            onClose={handleClose}
            onMinimize={handleMinimize}
            onMaximize={handleMaximize}
          />
        </div>

        {/* 中间：可滚动的 Tab 标签页列表 */}
        <div
          className="flex-1 flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar px-1 min-w-0 h-[38px]"
          data-tauri-drag-region
        >
          {hubState.tabs.map((tab) => {
            const isActive = tab.action_id === hubState.active_tab_id;
            return (
              <div
                key={tab.action_id}
                onClick={() => handleSwitchTab(tab.action_id)}
                className={cn(
                  'tab-item group flex items-center gap-1.5 px-2.5 h-[26px] rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 shrink-0 select-none border box-border',
                  isActive
                    ? 'bg-background/90 text-foreground shadow-sm border-black/10 dark:border-white/15 ring-1 ring-blue-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 border-transparent'
                )}
                title={tab.name}
              >
                <div
                  className={cn(
                    'w-3.5 h-3.5 rounded flex items-center justify-center shrink-0',
                    isActive ? 'text-blue-500 dark:text-blue-400' : 'text-muted-foreground'
                  )}
                >
                  <DynamicIcon name={tab.icon} size={12} />
                </div>

                <span className="truncate max-w-[110px] text-[11.5px] tracking-tight font-medium leading-none">
                  {tab.name}
                </span>

                <button
                  type="button"
                  onClick={(e) => handleCloseTab(e, tab.action_id)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-black/10 dark:hover:bg-white/15 transition-colors ml-0.5"
                  title={`关闭 ${tab.name}`}
                >
                  <X size={10} strokeWidth={2.5} />
                </button>
              </div>
            );
          })}

          {/* 新建/添加 Tab 按钮及横向水平展开选择栏 */}
          <div className="relative shrink-0 flex items-center h-full" ref={menuRef}>
            {isPlusMenuOpen ? (
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/10 rounded-lg p-0.5 border border-black/10 dark:border-white/15 animate-in fade-in zoom-in-95 duration-150 shrink-0">
                <span className="text-[10px] text-muted-foreground px-1.5 font-medium select-none">
                  开启:
                </span>
                {availableWebActions.length > 0 ? (
                  availableWebActions.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleOpenNewTab(act.id)}
                      className="flex items-center gap-1 px-2 h-[22px] rounded-md text-xs text-foreground bg-background/90 hover:bg-blue-500/15 hover:text-blue-500 border border-black/5 dark:border-white/10 transition-all cursor-pointer shadow-xs"
                      title={`打开 ${act.name}`}
                    >
                      <DynamicIcon name={act.icon} size={11} />
                      <span className="text-[11px] font-medium leading-none">{act.name}</span>
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={handleOpenSettings}
                    className="flex items-center gap-1 px-2 h-[22px] rounded-md text-[11px] text-blue-500 hover:bg-blue-500/15 transition-all cursor-pointer"
                    title="前往动作设置"
                  >
                    <Settings size={11} />
                    <span>去配置更多动作</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(false)}
                  className="w-5 h-5 rounded-md text-muted-foreground hover:text-foreground inline-flex items-center justify-center transition-colors cursor-pointer"
                  title="收起"
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlusMenuOpen(true);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title={availableWebActions.length > 0 ? "打开其他 AI 官网" : "管理 Web 动作"}
              >
                <Plus size={13} />
              </button>
            )}
          </div>
        </div>

        {/* 右侧：工具栏 */}
        <div className="flex items-center gap-1 shrink-0 pl-2 h-full">
          <button
            type="button"
            onClick={handleReload}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="刷新当前页面"
          >
            <RotateCw size={12} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
          </button>

          {currentActiveTab?.url && (
            <button
              type="button"
              onClick={handleOpenExternal}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="在默认浏览器中打开"
            >
              <ExternalLink size={12} />
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenSettings}
            onMouseDown={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="打开 Web 浮窗设置"
          >
            <Settings size={12} />
          </button>
        </div>
      </header>
    </div>
  );
};
