import React, { useState } from 'react';
import { cn } from '@/lib/utils';

export interface MacTrafficLightsProps {
  onClose?: (e: React.MouseEvent) => void;
  onMinimize?: (e: React.MouseEvent) => void;
  onMaximize?: (e: React.MouseEvent) => void;
  closeTitle?: string;
  minimizeTitle?: string;
  maximizeTitle?: string;
  isPinned?: boolean;
  className?: string;
}

export const MacTrafficLights: React.FC<MacTrafficLightsProps> = ({
  onClose,
  onMinimize,
  onMaximize,
  closeTitle = '关闭 (Esc)',
  minimizeTitle = '最小化',
  maximizeTitle = '最大化 / 还原',
  isPinned,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn("mac-traffic-lights flex items-center gap-2 select-none", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 1. 红色关闭按钮 */}
      <button
        type="button"
        className="traffic-light traffic-light-close"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.(e);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title={closeTitle}
        tabIndex={-1}
      >
        {isHovered && (
          <svg viewBox="0 0 24 24" className="traffic-icon" aria-hidden="true">
            <path
              d="M6 6L18 18M6 18L18 6"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* 2. 黄色最小化/取消按钮 */}
      <button
        type="button"
        className="traffic-light traffic-light-minimize"
        onClick={(e) => {
          e.stopPropagation();
          onMinimize?.(e);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title={minimizeTitle}
        tabIndex={-1}
      >
        {isHovered && (
          <svg viewBox="0 0 24 24" className="traffic-icon" aria-hidden="true">
            <path
              d="M4 12H20"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {/* 3. 绿色最大化 / Pin 固定按钮 */}
      <button
        type="button"
        className={cn(
          "traffic-light traffic-light-maximize",
          isPinned && "ring-1 ring-emerald-500/80 brightness-110"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onMaximize?.(e);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title={maximizeTitle}
        tabIndex={-1}
      >
        {isHovered && (
          <svg viewBox="0 0 24 24" className="traffic-icon" aria-hidden="true">
            <path
              d="M7 17L17 7M7 7H17V17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
};
