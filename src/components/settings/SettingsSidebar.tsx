import React from "react";
import { Cpu, Zap, Layers, MessageSquare, Globe, Sliders, Shield, Save } from "lucide-react";
import { Button } from "@/components/ui";
import { IOXLogo } from "@/components/common";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { SettingsTab } from "@/types/config";

export type { SettingsTab };

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  onSave: () => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeTab,
  onTabChange,
  onSave,
}) => {
  const { t } = useTranslation();

  const navItems: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "providers", label: t('settings.sidebar.providers'), icon: Cpu },
    { id: "actions", label: t('settings.sidebar.actions'), icon: Zap },
    { id: "api_card", label: t('settings.sidebar.apiCard'), icon: Layers },
    { id: "sessions", label: t('settings.sidebar.sessions'), icon: MessageSquare },
    { id: "web", label: t('settings.sidebar.web'), icon: Globe },
    { id: "general", label: t('settings.sidebar.general'), icon: Sliders },
    { id: "blacklist", label: t('settings.sidebar.blacklist'), icon: Shield },
  ];

  return (
    <aside className="w-48 shrink-0 flex flex-col justify-between border-r border-border/40 bg-transparent p-3.5 select-none">
      {/* Brand Header */}
      <div>
        <div className="px-2 py-1 mb-5 flex items-center gap-2.5">
          <IOXLogo
            variant="solid"
            size={34}
            className="rounded-lg shadow-xs shrink-0"
          />
          <div className="flex flex-col justify-center">
            <span className="text-base font-bold tracking-tight bg-gradient-to-br from-blue-500 via-indigo-400 to-violet-400 bg-clip-text text-transparent leading-none">
              IOX
            </span>
            <p className="text-[10.5px] text-muted-foreground mt-1 font-medium leading-none">
              {t('settings.subtitle')}
            </p>
          </div>
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
          title={`${t('common.save')} (Ctrl + S)`}
          className="w-full h-8 gap-1.5 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-150 shadow-xs active:scale-[0.98]"
        >
          <Save size={13} />
          <span>{t('common.save')}</span>
        </Button>
      </div>
    </aside>
  );
};
