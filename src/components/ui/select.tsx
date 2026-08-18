import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ElementType;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  onChange?: (value: string) => void;
  children?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      options: propOptions,
      placeholder = "请选择...",
      disabled = false,
      className,
      wrapperClassName,
      onChange,
      children,
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(
      defaultValue || ""
    );
    const [isOpen, setIsOpen] = React.useState(false);
    const [coords, setCoords] = React.useState<{
      top?: number;
      bottom?: number;
      left: number;
      width: number;
      placement: "bottom" | "top";
    } | null>(null);

    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // 解析 options: 优先使用 propOptions，否则从 children (<option>) 中提取
    const options = React.useMemo<SelectOption[]>(() => {
      if (propOptions && propOptions.length > 0) {
        return propOptions;
      }
      const parsed: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === "option") {
          const childProps = child.props as React.OptionHTMLAttributes<HTMLOptionElement>;
          parsed.push({
            value: String(childProps.value ?? ""),
            label: String(childProps.children ?? childProps.value ?? ""),
            disabled: Boolean(childProps.disabled),
          });
        }
      });
      return parsed;
    }, [propOptions, children]);

    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled ? controlledValue : uncontrolledValue;
    const selectedOption = options.find((opt) => opt.value === currentValue);

    // 计算弹窗绝对屏幕位置，避免被任何父级 Stacking Context 或 overflow: hidden 裁剪
    const updatePosition = React.useCallback(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placement = spaceBelow < 180 && spaceAbove > spaceBelow ? "top" : "bottom";

      if (placement === "bottom") {
        setCoords({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
          placement: "bottom",
        });
      } else {
        setCoords({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: rect.width,
          placement: "top",
        });
      }
    }, []);

    const toggleOpen = () => {
      if (disabled) return;
      if (!isOpen) {
        updatePosition();
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    // 监听滚动与尺寸变化，实时同步弹窗坐标或关闭
    React.useEffect(() => {
      if (!isOpen) return;

      const handleScrollOrResize = () => {
        updatePosition();
      };

      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          triggerRef.current &&
          !triggerRef.current.contains(target) &&
          dropdownRef.current &&
          !dropdownRef.current.contains(target)
        ) {
          setIsOpen(false);
        }
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsOpen(false);
        }
      };

      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [isOpen, updatePosition]);

    const handleSelect = (option: SelectOption) => {
      if (option.disabled || disabled) return;
      if (!isControlled) {
        setUncontrolledValue(option.value);
      }
      setIsOpen(false);
      onChange?.(option.value);
    };

    const SelectedIcon = selectedOption?.icon;

    return (
      <div
        ref={ref}
        className={cn("relative w-full select-none", wrapperClassName)}
      >
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border border-input/80 bg-background/50 px-2.5 py-1 text-xs text-foreground shadow-none transition-all duration-150 outline-none",
            "hover:bg-accent/40 hover:border-input active:scale-[0.99]",
            isOpen && "ring-1.5 ring-primary border-primary bg-background/80",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {SelectedIcon && (
              <SelectedIcon
                size={13}
                className="text-muted-foreground shrink-0"
              />
            )}
            <span
              className={cn(
                "truncate",
                !selectedOption && "text-muted-foreground"
              )}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown
            size={13}
            className={cn(
              "text-muted-foreground opacity-70 shrink-0 transition-transform duration-200",
              isOpen && "rotate-180 text-foreground opacity-100"
            )}
          />
        </button>

        {/* Dropdown Menu Popup via React Portal directly into body */}
        {isOpen &&
          coords &&
          createPortal(
            <div
              ref={dropdownRef}
              style={{
                top: coords.top !== undefined ? `${coords.top}px` : undefined,
                bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
                left: `${coords.left}px`,
                width: `${coords.width}px`,
              }}
              className={cn(
                "fixed z-[99999] overflow-hidden",
                "rounded-lg border border-border/80 bg-popover/95 dark:bg-zinc-900/95 p-1",
                "backdrop-blur-2xl shadow-2xl",
                coords.placement === "bottom"
                  ? "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
                  : "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-150"
              )}
            >
              <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar">
                {options.length === 0 ? (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                    暂无可用选项
                  </div>
                ) : (
                  options.map((opt) => {
                    const isSelected = opt.value === currentValue;
                    const Icon = opt.icon;

                    return (
                      <div
                        key={opt.value}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(opt)}
                        className={cn(
                          "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer outline-none select-none",
                          opt.disabled
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                            ? "bg-primary/12 text-primary font-medium dark:text-blue-400"
                            : "text-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {Icon && (
                            <Icon
                              size={13}
                              className={cn(
                                "shrink-0",
                                isSelected
                                  ? "text-primary dark:text-blue-400"
                                  : "text-muted-foreground"
                              )}
                            />
                          )}
                          <div className="flex flex-col truncate">
                            <span className="truncate">{opt.label}</span>
                            {opt.description && (
                              <span className="text-[10px] text-muted-foreground/70 truncate">
                                {opt.description}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <Check
                            size={12}
                            className="text-primary dark:text-blue-400 shrink-0 stroke-[2.5]"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }
);
Select.displayName = "Select";
