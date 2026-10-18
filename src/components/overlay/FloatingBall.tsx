import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ActionConfig, AppConfig } from '@/types/config';
import { IOXLogo } from '@/components/common';
import { FloatingMenu } from './FloatingMenu';
import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/hooks/useTranslation';

export interface FloatingBallProps {
  config: AppConfig | null;
}

export const FloatingBall: React.FC<FloatingBallProps> = ({ config }) => {
  const { t } = useTranslation();
  const [edge, setEdge] = useState<'left' | 'right'>('right');
  const [isIdle, setIsIdle] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [capturedText, setCapturedText] = useState('');

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isMouseDownRef = useRef(false);

  // 启动/重置闲置半隐藏计时器 (2.5s)
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setIsIdle(false);

    if (config?.general?.floatingBallAutoHide && !isExpanded && !isDragging) {
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 2500);
    }
  }, [config?.general?.floatingBallAutoHide, isExpanded, isDragging]);

  // 初始化只跟随启用状态；展开/拖拽不能重新初始化原生窗口。
  useEffect(() => {
    if (config?.general?.enableFloatingBall === false) {
      return;
    }
    const init = async () => {
      try {
        const res = await invoke<[number, number, string]>('init_floating_ball');
        if (res && res[2]) {
          setEdge(res[2] as 'left' | 'right');
        }
      } catch (e) {
        console.error('Failed to init floating ball:', e);
      }
    };
    init();

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, [config?.general?.enableFloatingBall]);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // 当展开/收起状态改变时，原子性动态调整窗口尺寸与屏幕贴边坐标
  useEffect(() => {
    if (config?.general?.enableFloatingBall === false) {
      return;
    }
    const adjustWindowSize = async () => {
      try {
        const res = await invoke<[number, number, string]>('set_floating_ball_expanded', {
          expanded: isExpanded,
          width: 290,
          height: 260,
        });
        if (res && res[2]) {
          setEdge(res[2] as 'left' | 'right');
        }
        if (isExpanded) {
          setIsIdle(false);
        }
      } catch (e) {
        console.error('Failed to adjust floating ball window size:', e);
      }
    };
    adjustWindowSize();
  }, [isExpanded, config?.general?.enableFloatingBall]);

  // 处理鼠标按下 (准备拖拽或点击判定)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // 仅左键
    isMouseDownRef.current = true;
    dragStartPosRef.current = { x: e.screenX, y: e.screenY };
    setIsIdle(false);
  };

  // 处理鼠标移动 (超过 5px 触发拖拽)
  const handleMouseMove = async (e: React.MouseEvent) => {
    if (!isMouseDownRef.current || !dragStartPosRef.current || isDragging || isExpanded) return;

    const dx = Math.abs(e.screenX - dragStartPosRef.current.x);
    const dy = Math.abs(e.screenY - dragStartPosRef.current.y);

    if (dx > 5 || dy > 5) {
      setIsDragging(true);
      isMouseDownRef.current = false;
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }

      try {
        const res = await invoke<[number, number, string]>('start_floating_ball_dragging');
        if (res && res[2]) {
          setEdge(res[2] as 'left' | 'right');
        }
      } catch (err) {
        console.error('Dragging error:', err);
      } finally {
        setIsDragging(false);
        resetIdleTimer();
      }
    }
  };

  // 处理鼠标抬起 (未拖拽时区分单击与双击)
  const handleMouseUp = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;

    if (isDragging) return;

    // 检查是否在双击等待窗口内
    if (clickTimerRef.current) {
      // 触发双击：打开主设置面板
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      setIsExpanded(false);
      try {
        await invoke('show_main_window');
      } catch (err) {
        console.error('Failed to show main window:', err);
      }
      return;
    }

    // 启动 220ms 单击防抖计时器
    clickTimerRef.current = setTimeout(async () => {
      clickTimerRef.current = null;
      // 单击触发：检测选词并切换展开状态
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        try {
          const selected = await invoke<string | null>('get_current_selection');
          setCapturedText(selected?.trim() || '');
        } catch {
          setCapturedText('');
        }
        setIsExpanded(true);
      }
    }, 220);
  };

  const handleMouseEnter = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setIsIdle(false);
  };

  const handleMouseLeave = () => {
    if (!isExpanded && !isDragging) {
      resetIdleTimer();
    }
  };

  const handleTriggerAction = async (action: ActionConfig, customPrompt?: string) => {
    setIsExpanded(false);
    try {
      if (action.actionType === 'api') {
        await invoke('trigger_api_action', {
          actionId: action.id,
          text: customPrompt || capturedText,
        });
      } else {
        await invoke('trigger_web_action', {
          actionId: action.id,
          text: customPrompt || capturedText,
        });
      }
    } catch (e) {
      console.error('Failed to trigger action from floating ball:', e);
    }
  };

  const handleOpenSettings = async () => {
    setIsExpanded(false);
    try {
      await invoke('show_main_window');
    } catch (e) {
      console.error('Failed to open settings:', e);
    }
  };

  if (!config) return null;

  return (
    <div
      className={cn(
        'floating-ball-container select-none w-full h-full',
        isExpanded
          ? edge === 'left' ? 'items-start justify-start p-0' : 'items-end justify-start p-0'
          : 'flex items-center justify-center p-1.5 overflow-visible'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isExpanded ? (
        <FloatingMenu
          config={config}
          selectedText={capturedText}
          edge={edge}
          onClose={() => setIsExpanded(false)}
          onTriggerAction={handleTriggerAction}
          onOpenSettings={handleOpenSettings}
        />
      ) : (
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={cn(
            'floating-ball w-12 h-12 rounded-full aspect-square flex-shrink-0 cursor-grab active:cursor-grabbing',
            'flex items-center justify-center',
            edge === 'left' ? 'is-docked-left' : 'is-docked-right',
            isIdle && 'is-idle'
          )}
          title={t('bubble.floatingBallTip')}
        >
          <div className="floating-ball-icon pointer-events-none flex items-center justify-center">
            <IOXLogo size={24} />
          </div>
        </div>
      )}
    </div>
  );
};
