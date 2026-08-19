import React, { useRef, useEffect } from "react";
import { Plus, Bot, Globe, Cpu, ChevronDown } from "lucide-react";
import { ActionConfig } from "@/types/config";
import { PRESET_ACTIONS, PresetActionTemplate } from "@/lib/presetActions";
import { DynamicIcon } from "@/components/Icons";
import { Button } from "@/components/ui";

interface ActionPresetMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectPreset: (preset?: Partial<ActionConfig> & { defaultIdPrefix?: string }) => void;
}

export const ActionPresetMenu: React.FC<ActionPresetMenuProps> = ({
  isOpen,
  onToggle,
  onClose,
  onSelectPreset,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部自动关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("pointerdown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // 按分类分组预设
  const categories: { key: PresetActionTemplate["category"]; label: string; icon: React.ElementType }[] = [
    { key: "web", label: "Web 官网直达 (免 API 登录)", icon: Globe },
    { key: "api", label: "API 流式智能动作", icon: Bot },
    { key: "utility", label: "基础快捷工具", icon: Cpu },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <Button
        onClick={onToggle}
        size="sm"
        variant="default"
        className="gap-1 text-xs px-2.5 shadow-sm cursor-pointer"
      >
        <Plus size={13} />
        <span>添加动作</span>
        <ChevronDown size={11} className="opacity-70 ml-0.5" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 max-h-[420px] overflow-y-auto bg-background/95 backdrop-blur-xl border border-border/80 rounded-xl shadow-2xl p-1.5 space-y-2 animate-in fade-in zoom-in-95 duration-100 select-none">
          {/* 自定义空白动作 */}
          <div className="p-1 border-b border-border/40 pb-1.5">
            <button
              type="button"
              onClick={() => {
                onSelectPreset();
                onClose();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-left"
            >
              <div className="w-5 h-5 rounded bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Plus size={13} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs leading-tight">新建空白自定义动作</div>
                <div className="text-[10px] text-muted-foreground truncate">完全自定义名称、图标、类型与提示词</div>
              </div>
            </button>
          </div>

          {/* 各分类预设列表 */}
          {categories.map((cat) => {
            const items = PRESET_ACTIONS.filter((p) => p.category === cat.key);
            if (items.length === 0) return null;
            const Icon = cat.icon;

            return (
              <div key={cat.key} className="space-y-0.5 px-1">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1.5 py-0.5">
                  <Icon size={11} />
                  <span>{cat.label}</span>
                </div>

                <div className="grid grid-cols-1 gap-0.5">
                  {items.map((preset) => (
                    <button
                      key={preset.template.defaultIdPrefix}
                      type="button"
                      onClick={() => {
                        onSelectPreset({
                          ...preset.template,
                          defaultIdPrefix: preset.template.defaultIdPrefix,
                        });
                        onClose();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer text-left group"
                    >
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-foreground group-hover:text-primary shrink-0">
                        <DynamicIcon name={preset.template.icon} size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-xs text-foreground leading-tight truncate">
                          {preset.template.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                          {preset.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
