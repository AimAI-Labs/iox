import React from "react";
import { Cpu, Zap, Sliders, Shield, Save, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SettingsTab = "providers" | "actions" | "general" | "blacklist";

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onSave: () => void;
  saving: boolean;
  savedSuccess: boolean;
}

const navItems: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "providers", label: "模型服务商", icon: Cpu },
  { id: "actions", label: "动作管理", icon: Zap },
  { id: "general", label: "划词与通用", icon: Sliders },
  { id: "blacklist", label: "应用黑名单", icon: Shield },
];

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
  onSave,
  saving,
  savedSuccess,
}) => {
  return (
    <aside className="w-48 shrink-0 flex flex-col justify-between border-r border-border/40 bg-transparent p-3.5 select-none">
      {/* Brand Header */}
      <div>
        <div className="px-2 py-1 mb-5">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight bg-gradient-to-br from-blue-500 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
              IOX
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            划词 AI
          </p>
        </div>

        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-left outline-none",
                  isActive
                    ? "bg-primary/12 text-primary dark:text-blue-400 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                <Icon
                  size={14}
                  className={cn(
                    "transition-colors",
                    isActive ? "text-primary dark:text-blue-400" : "text-muted-foreground"
                  )}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Save Button in Footer */}
      <div className="pt-3 border-t border-border/30">
        <Button
          onClick={onSave}
          disabled={saving}
          variant={savedSuccess ? "default" : "default"}
          className={cn(
            "w-full h-8 gap-1.5 text-xs font-medium transition-all duration-200",
            savedSuccess
              ? "bg-emerald-600 hover:bg-emerald-600 text-white"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
        >
          {saving ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>保存中...</span>
            </>
          ) : savedSuccess ? (
            <>
              <Check size={13} className="stroke-[2.5]" />
              <span>已保存</span>
            </>
          ) : (
            <>
              <Save size={13} />
              <span>保存配置</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};
