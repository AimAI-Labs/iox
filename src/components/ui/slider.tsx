import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      min = 0,
      max = 100,
      step = 1,
      onChange,
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(
      Math.max(((value - min) / (max - min)) * 100, 0),
      100
    );

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (disabled) return;
      onChange(Number(e.target.value));
    };

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex items-center select-none touch-none w-full h-5 group",
          disabled && "opacity-50 pointer-events-none",
          className
        )}
      >
        {/* 轨道背景 */}
        <div className="relative w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          {/* 激活高亮进度条 */}
          <div
            className="h-full bg-primary transition-all duration-75"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* 原生 range input 实现最自然的拖拽和触控体验 */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          {...props}
        />

        {/* 自定义拖拽圆环手柄 */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white dark:bg-zinc-100 rounded-full border-2 border-primary shadow-sm pointer-events-none transition-transform duration-75",
            "group-hover:scale-110 group-active:scale-95"
          )}
          style={{ left: `calc(${percentage}% - 7px)` }}
        />
      </div>
    );
  }
);

Slider.displayName = "Slider";
