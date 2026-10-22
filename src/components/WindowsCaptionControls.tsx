import React from 'react';
import { cn } from '@/lib/utils';

export interface WindowsCaptionControlsProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
  closeTitle?: string;
  minimizeTitle?: string;
  maximizeTitle?: string;
  className?: string;
}

const BUTTON_CLASS =
  'inline-flex h-6 w-7 items-center justify-center rounded-none text-zinc-500 transition-colors duration-100 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 cursor-pointer';

/** Windows 原生风格的最小化 / 最大化 / 关闭按钮组 */
export const WindowsCaptionControls: React.FC<WindowsCaptionControlsProps> = ({
  onClose,
  onMinimize,
  onMaximize,
  isMaximized = false,
  closeTitle = '关闭',
  minimizeTitle = '最小化',
  maximizeTitle = '最大化',
  className,
}) => {
  const handle = (action?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action?.();
  };

  return (
    <div
      className={cn('flex shrink-0 items-center', className)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        tabIndex={-1}
        className={BUTTON_CLASS}
        onClick={handle(onMinimize)}
        onMouseDown={(e) => e.stopPropagation()}
        title={minimizeTitle}
      >
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>

      <button
        type="button"
        tabIndex={-1}
        className={BUTTON_CLASS}
        onClick={handle(onMaximize)}
        onMouseDown={(e) => e.stopPropagation()}
        title={maximizeTitle}
      >
        {isMaximized ? (
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
            <rect
              x="1.5"
              y="4"
              width="6.5"
              height="6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path d="M4 4V1.5h6.5V8H8" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
            <rect
              x="2"
              y="2"
              width="8"
              height="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        )}
      </button>

      <button
        type="button"
        tabIndex={-1}
        className={cn(
          BUTTON_CLASS,
          'hover:bg-[#e81123] hover:text-white dark:hover:bg-[#e81123] dark:hover:text-white'
        )}
        onClick={handle(onClose)}
        onMouseDown={(e) => e.stopPropagation()}
        title={closeTitle}
      >
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
};
