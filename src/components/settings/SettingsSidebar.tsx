import React from "react";
import { Cpu, Zap, Layers, MessageSquare, MessagesSquare, Globe, Sliders, Shield, Save, Code, Database, RefreshCw, ArrowUpRight, Copy, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { IOXLogo } from "@/components/common";
import { useCopyFeedback } from "@/hooks/useCopyFeedback";
import { useTranslation } from "@/hooks/useTranslation";
import { useUpdateCheck } from "@/hooks/useUpdateCheck";
import { cn } from "@/lib/utils";
import { presentUpdateStatus, type UpdateTone } from "@/lib/updatePresentation";
import { SettingsTab } from "@/types/config";

export type { SettingsTab };

const menuItemClassName = "w-full h-8 justify-start gap-2.5 px-2.5 text-xs text-muted-foreground";

const toneStyles: Record<UpdateTone, { dot: string; badge: string }> = {
  idle: { dot: "bg-muted-foreground/50", badge: "bg-black/5 text-muted-foreground dark:bg-white/5" },
  checking: { dot: "bg-blue-400 animate-pulse", badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  current: { dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  available: { dot: "bg-primary animate-pulse", badge: "bg-primary/10 text-primary" },
  warning: { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

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
  const { t, resolvedLanguage } = useTranslation();
  const { version, status, checking, check } = useUpdateCheck();
  const { copied, copy } = useCopyFeedback();
  const displayVersion = version || status?.currentVersion || '';
  const presentation = presentUpdateStatus(status, checking, Date.now(), resolvedLanguage);
  const badgeLabel = t(presentation.badgeKey);
  const detail = t(presentation.detailKey, presentation.detailParams);
  const tone = toneStyles[presentation.tone];
  const copyLabel = copied ? t('settings.update.versionCopied') : t('settings.update.copyVersion');
  const releaseLabel = t('settings.update.openRelease');
  const checkLabel = t('settings.update.check');

  const handleCopyVersion = async () => {
    if (!displayVersion) return;
    await copy(`v${displayVersion}`);
  };

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
        <div className="space-y-1.5 rounded-lg border border-border/40 bg-black/[0.02] px-2.5 py-2 dark:bg-white/[0.03]">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={() => void handleCopyVersion()}
              disabled={!displayVersion}
              title={displayVersion ? copyLabel : undefined}
              aria-label={displayVersion ? copyLabel : undefined}
              className="group inline-flex min-w-0 items-center gap-1 rounded font-mono text-[11px] font-medium text-foreground/75 transition-colors hover:text-foreground disabled:cursor-default"
            >
              <span>v{displayVersion || '—'}</span>
              {copied
                ? <Check size={10} className="shrink-0 text-emerald-500" />
                : <Copy size={10} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />}
            </button>
            <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium", tone.badge)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              {badgeLabel}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={cn(
                "min-w-0 truncate text-[10px] text-muted-foreground",
                presentation.tone === 'available' && "text-primary"
              )}
              title={detail}
            >
              {detail}
            </span>
            <div className="flex shrink-0 items-center gap-0.5">
              {presentation.showReleaseLink && (
                <button
                  type="button"
                  onClick={handleOpenRelease}
                  title={releaseLabel}
                  aria-label={releaseLabel}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5"
                >
                  <ArrowUpRight size={11} />
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleCheckUpdate()}
                disabled={checking}
                title={checkLabel}
                aria-label={checkLabel}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground disabled:opacity-60 dark:hover:bg-white/5",
                  presentation.tone === 'idle' && "px-1.5"
                )}
              >
                <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
                {presentation.tone === 'idle' && <span className="text-[10px] leading-none">{checkLabel}</span>}
              </button>
            </div>
          </div>
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
