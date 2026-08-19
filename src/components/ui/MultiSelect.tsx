import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  values: string[];
  options: MultiSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  onChange: (values: string[]) => void;
  allowCustomInput?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  values,
  options: propOptions,
  placeholder = "请选择模型...",
  disabled = false,
  className,
  wrapperClassName,
  onChange,
  allowCustomInput = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [coords, setCoords] = React.useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    placement: "bottom" | "top";
  } | null>(null);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // 合并已选中的自定义值与传入的可选列表，确保已选项始终在选项中
  const allOptions = React.useMemo<MultiSelectOption[]>(() => {
    const map = new Map<string, MultiSelectOption>();
    propOptions.forEach((opt) => map.set(opt.value, opt));
    values.forEach((v) => {
      if (!map.has(v)) {
        map.set(v, { value: v, label: v });
      }
    });
    return Array.from(map.values());
  }, [propOptions, values]);

  // 过滤后的选项列表
  const filteredOptions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allOptions;
    return allOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q)
    );
  }, [allOptions, searchQuery]);

  // 是否允许将搜索词作为新自定义项添加
  const canAddNew =
    allowCustomInput &&
    searchQuery.trim().length > 0 &&
    !allOptions.some(
      (opt) => opt.value.toLowerCase() === searchQuery.trim().toLowerCase()
    );

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placement = spaceBelow < 240 && spaceAbove > spaceBelow ? "top" : "bottom";

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
      setSearchQuery("");
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setIsOpen(false);
    }
  };

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
    window.addEventListener("scroll", handleScrollOrResize, {
      capture: true,
      passive: true,
    });
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updatePosition]);

  const handleToggleOption = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    const allValues = allOptions.map((opt) => opt.value);
    onChange(allValues);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleAddCustom = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setSearchQuery("");
  };

  return (
    <div className={cn("relative w-full select-none", wrapperClassName)}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-input/80 bg-background/50 px-2.5 py-1 text-xs text-foreground shadow-none transition-all duration-150 outline-none cursor-pointer",
          "hover:bg-accent/40 hover:border-input active:scale-[0.99]",
          isOpen && "ring-1.5 ring-primary border-primary bg-background/80",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {values.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="text-xs font-medium text-foreground">
              已选 {values.length} 个模型
              <span className="text-[11px] text-muted-foreground ml-1.5 font-normal">
                ({values.slice(0, 2).join(", ")}
                {values.length > 2 ? ` 等` : ""})
              </span>
            </span>
          )}
        </div>

        <ChevronDown
          size={13}
          className={cn(
            "text-muted-foreground opacity-70 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-foreground opacity-100"
          )}
        />
      </button>

      {/* Dropdown Popup */}
      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              left: coords.left,
              width: Math.max(coords.width, 260),
            }}
            className={cn(
              "fixed z-[99999] overflow-hidden",
              "rounded-lg border border-border/80 bg-popover/95 dark:bg-zinc-900/95 p-1.5",
              "backdrop-blur-2xl shadow-2xl space-y-1.5",
              coords.placement === "bottom"
                ? "animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150"
                : "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-1 duration-150"
            )}
          >
            {/* Search Input Bar */}
            <div className="relative flex items-center">
              <Search
                size={12}
                className="absolute left-2 text-muted-foreground pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                placeholder="搜索或输入自定义模型..."
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAddNew) {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                className="h-7 w-full rounded-md bg-muted/50 border border-input/60 pl-6 pr-6 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/80 focus:bg-background/80"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 text-muted-foreground hover:text-foreground outline-none"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Quick Actions Header */}
            <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground border-b border-border/40 pb-1">
              <span>共 {allOptions.length} 个模型 (已选 {values.length})</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-primary hover:underline outline-none cursor-pointer"
                >
                  全选
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="hover:text-destructive outline-none cursor-pointer"
                >
                  清空
                </button>
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar">
              {canAddNew && (
                <div
                  role="button"
                  onClick={handleAddCustom}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-primary bg-primary/10 hover:bg-primary/20 cursor-pointer font-medium"
                >
                  <Plus size={12} className="shrink-0" />
                  <span className="truncate">添加并勾选: "{searchQuery.trim()}"</span>
                </div>
              )}

              {filteredOptions.length === 0 && !canAddNew ? (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  未匹配到模型
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isChecked = values.includes(opt.value);

                  return (
                    <div
                      key={opt.value}
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => handleToggleOption(opt.value)}
                      className={cn(
                        "flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer outline-none select-none",
                        isChecked
                          ? "bg-primary/10 text-primary font-medium dark:text-blue-400"
                          : "text-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={cn(
                            "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0",
                            isChecked
                              ? "bg-primary border-primary text-primary-foreground dark:bg-blue-600 dark:border-blue-600"
                              : "border-muted-foreground/40 bg-background/50"
                          )}
                        >
                          {isChecked && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className="truncate font-mono text-[11px]">
                          {opt.label}
                        </span>
                      </div>
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
};
