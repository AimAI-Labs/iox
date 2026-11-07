import React from "react";
import { Cpu, Zap, Layers, MessageSquare, MessagesSquare, Globe, Sliders, Shield, Save, Code, Database, RefreshCw, ArrowUpRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { IOXLogo } from "@/components/common";
import { useTranslation } from "@/hooks/useTranslation";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { cn } from "@/lib/utils";
import { SettingsTab } from "@/types/config";

export type { SettingsTab };

const menuItemClassName = "w-full h-8 justify-start gap-2.5 px-2.5 text-xs text-muted-foreground";

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
  const { version, status, checking, check } = useUpdateCheck();
  const latestVersion = status?.state === 'available' ? status.latestVersion : null;
  const needsAttention = status?.state === 'unavailable' || status?.state === 'unknown';

  const handleOpenRelease = () => {
    const fallback = 'https://github.com/AimAI-Labs/iox/releases';
    const url = status?.releaseUrl?.startsWith('https://github.com/AimAI-Labs/iox/')
      ? status.releaseUrl
      : fallback;
    void openUrl(url).catch(() => {});
  };

  const handleCheckUpdate = async () => {
    try {
      const result = await check();
      if (!result) return;
      if (result.state === 'available' && result.latestVersion) {
        toast.success(t('settings.update.available'), {
          description: `v${result.latestVersion}`,
          action: { label: t('settings.update.openRelease'), onClick: handleOpenRelease },
        });
      } else if (result.state === 'current') {
        toast.success(t('settings.update.latest'));
      } else if (result.state === 'unknown') {
        toast.info(t('settings.update.unknown'), {
          action: { label: t('settings.update.openRelease'), onClick: handleOpenRelease },
        });
      } else {
        toast.info(t('settings.update.failed'), {
          action: { label: t('settings.update.openRelease'), onClick: handleOpenRelease },
        });
      }
    } catch {
      toast.info(t('settings.update.failed'), {
        action: { label: t('settings.update.openRelease'), onClick: handleOpenRelease },
      });
    }
  };

  const navItems: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
    { id: "providers", label: t('settings.sidebar.providers'), icon: Cpu },
    { id: "actions", label: t('settings.sidebar.actions'), icon: Zap },
    { id: "api_card", label: t('settings.sidebar.apiCard'), icon: Layers },
    { id: "sessions", label: t('settings.sidebar.sessions'), icon: MessageSquare },
    { id: "sync", label: t('settings.sidebar.sync'), icon: Database },
    { id: "web_sessions", label: t('settings.sidebar.webSessions'), icon: MessagesSquare },
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
              <Button
                key={item.id}
                type="button"
                variant="ghost"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center justify-start gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 text-left outline-none",
                  isActive
                    ? "bg-primary/12 text-primary dark:text-blue-400 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                <Icon size={14} className="shrink-0" />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </nav>
      </div>

      {/* Save Button in Footer */}
      <div className="pt-3 border-t border-border/30 space-y-2">
        <div className="flex items-center justify-between gap-2 px-2.5 pb-0.5">
          <span
            className="font-mono text-[10.5px] text-muted-foreground"
            title={status?.state === 'unknown'
              ? t('settings.update.unknown')
              : status?.state === 'unavailable'
                ? t('settings.update.failed')
                : undefined}
          >
            v{version || '…'}
          </span>
          {latestVersion ? (
            <button
              type="button"
              onClick={handleOpenRelease}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/15"
              title={t('settings.update.available')}
            >
              <ArrowUpRight size={11} />
              <span>{t('settings.update.availableShort')} v{latestVersion}</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1">
              {needsAttention && (
                <button
                  type="button"
                  onClick={handleOpenRelease}
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                  title={status?.state === 'unknown' ? t('settings.update.unknown') : t('settings.update.failed')}
                >
                  <ArrowUpRight size={10} />
                  <span>{t('settings.update.openRelease')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleCheckUpdate()}
                disabled={checking}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground disabled:opacity-60 dark:hover:bg-white/5"
                title={needsAttention ? t('settings.update.failed') : t('settings.update.check')}
              >
                <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
                <span>
                  {checking
                    ? t('settings.update.checking')
                    : status === null
                      ? t('settings.update.notChecked')
                      : t('settings.update.check')}
                </span>
              </button>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            try {
              await invoke("open_settings_devtools");
            } catch (error) {
              toast.error(t('settings.sidebar.devtoolsFailed'), { description: String(error) });
            }
          }}
          className={menuItemClassName}
        >
          <Code size={14} />
          <span>{t('settings.sidebar.devtools')}</span>
        </Button>
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
