import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DynamicIcon,
  POPULAR_AI_ICONS,
  COMMON_FUNCTION_ICONS,
} from "@/components/Icons";

export interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  trigger?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  disabled?: boolean;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  trigger,
  align = "left",
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    placement: "bottom" | "top";
  } | null>(null);

  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 计算弹层位置，使用 Portal 挂载到 body，避免被任何父容器 overflow:hidden 裁剪
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 330;
    const popoverHeight = 340;
    const margin = 8;
    const padding = 12;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placement = spaceBelow < popoverHeight && spaceAbove > spaceBelow ? "top" : "bottom";

    // 计算水平 Left 坐标
    let left = rect.left;
    if (align === "right") {
      left = rect.right - popoverWidth;
    } else if (align === "center") {
      left = rect.left + rect.width / 2 - popoverWidth / 2;
    }

    // 边界溢出修正
    if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - popoverWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    if (placement === "bottom") {
      setCoords({
        top: rect.bottom + margin,
        left,
        placement: "bottom",
      });
    } else {
      setCoords({
        bottom: window.innerHeight - rect.top + margin,
        left,
        placement: "top",
      });
    }
  }, [align]);

  // 打开/关闭切换
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (!isOpen) {
      setCustomInput("");
      updatePosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  // 窗口 resize 或滚动时更新位置
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // 点击外部及按 Esc 键关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const path = e.composedPath ? e.composedPath() : [];
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !path.includes(popoverRef.current) &&
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        !path.includes(triggerRef.current)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // 选中图标并关闭
  const handleSelectIcon = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
  };

  // 自定义图标提交
  const handleApplyCustomIcon = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onChange(customInput.trim());
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* 触发容器 */}
      <div
        ref={triggerRef}
        onClick={handleToggle}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn("inline-flex items-center select-none cursor-pointer", className)}
      >
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 hover:border-primary/50 text-xs font-medium text-foreground transition-all cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center text-primary">
              <DynamicIcon name={value} size={15} />
            </div>
            <span className="truncate max-w-[100px]">{value || "选择图标"}</span>
            <ChevronDown size={12} className="text-muted-foreground ml-auto" />
          </button>
        )}
      </div>

      {/* Portal 悬浮弹窗 */}
      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: coords.top !== undefined ? `${coords.top}px` : "auto",
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : "auto",
              left: `${coords.left}px`,
              width: "330px",
              zIndex: 99999,
            }}
            className={cn(
              "flex flex-col max-h-[360px] rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden",
              "text-popover-foreground text-xs select-none",
              coords.placement === "bottom"
                ? "animate-in fade-in slide-in-from-top-1 zoom-in-95 duration-150"
                : "animate-in fade-in slide-in-from-bottom-1 zoom-in-95 duration-150"
            )}
          >
            {/* 图标网格列表滚动区域 */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-3 min-h-0">
              {/* 分组 1: AI 品牌精选 */}
              <div>
                <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>🤖 AI 官方品牌图标</span>
                  <span className="font-mono text-[9px] opacity-70">
                    {POPULAR_AI_ICONS.length}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {POPULAR_AI_ICONS.map((item) => {
                    const isSelected =
                      value?.toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleSelectIcon(item.name)}
                        title={item.label}
                        className={cn(
                          "group relative flex items-center justify-center h-8.5 rounded-lg border transition-all duration-150 cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/15 text-primary shadow-xs ring-1 ring-primary/40 scale-105"
                            : "border-border/40 bg-muted/20 hover:bg-accent hover:border-border hover:scale-108 hover:shadow-xs"
                        )}
                      >
                        <DynamicIcon name={item.name} size={18} />
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[7px]">
                            <Check size={8} className="stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 分组 2: 通用功能精选 */}
              <div>
                <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>⚡ 常用功能图标</span>
                  <span className="font-mono text-[9px] opacity-70">
                    {COMMON_FUNCTION_ICONS.length}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {COMMON_FUNCTION_ICONS.map((item) => {
                    const isSelected =
                      value?.toLowerCase() === item.name.toLowerCase();
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleSelectIcon(item.name)}
                        title={item.label}
                        className={cn(
                          "group relative flex items-center justify-center h-8.5 rounded-lg border transition-all duration-150 cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/15 text-primary shadow-xs ring-1 ring-primary/40 scale-105"
                            : "border-border/40 bg-muted/20 text-foreground/80 hover:text-primary hover:bg-accent hover:border-border hover:scale-108 hover:shadow-xs"
                        )}
                      >
                        <DynamicIcon name={item.name} size={16} />
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[7px]">
                            <Check size={8} className="stroke-[3]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 底部：当前选中 & 自定义输入折叠 */}
            <div className="p-2 border-t border-border/40 bg-muted/30 shrink-0 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span>当前:</span>
                  <div className="flex items-center gap-1 font-medium text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border/50">
                    <DynamicIcon name={value} size={12} />
                    <span className="font-mono text-[10px] truncate max-w-[100px]">
                      {value || "未设置"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowCustomInput((prev) => !prev)}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal size={10} />
                  <span>{showCustomInput ? "收起自定义" : "高级输入"}</span>
                </button>
              </div>

              {/* 折叠的高级自定义输入 */}
              {showCustomInput && (
                <form
                  onSubmit={handleApplyCustomIcon}
                  className="flex items-center gap-1.5 pt-1 animate-in fade-in duration-100"
                >
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="输入 Lucide 图标名称 (如 Sparkles, Zap)..."
                      className="w-full h-7 pl-2 pr-7 text-[11px] font-mono bg-background border border-border/70 rounded-md focus:outline-none focus:border-primary"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <DynamicIcon name={customInput || "Sparkles"} size={12} />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!customInput.trim()}
                    className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    应用
                  </button>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
