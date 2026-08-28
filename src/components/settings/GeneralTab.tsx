import React from "react";
import { Monitor, Moon, Sun, Sparkles } from "lucide-react";
import { GeneralConfig, LanguageSetting } from "@/types/config";
import { switchThemeWithTransition } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  Input,
  Label,
  Select,
  Slider,
  Switch,
  Separator,
} from "@/components/ui";
import { IOXLogo } from "@/components/common";

interface GeneralTabProps {
  general: GeneralConfig;
  onUpdateGeneral: (updated: Partial<GeneralConfig>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  general,
  onUpdateGeneral,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {t('settings.general.title')}
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t('settings.general.subtitle')}
        </p>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          {/* 1. Interface Language Switcher */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.general.language')}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isZh
                  ? "选择界面显示语言（默认自动检测系统语言，无中文显示英文）"
                  : "Choose UI language (auto-detects system locale, defaults to English if non-Chinese)"}
              </p>
            </div>
            <div className="w-52">
              <Select
                value={general.language || "auto"}
                onChange={(val) =>
                  onUpdateGeneral({
                    language: val as LanguageSetting,
                  })
                }
                options={[
                  { value: "auto", label: t('settings.general.languageAuto') },
                  { value: "zh", label: t('settings.general.languageZh') },
                  { value: "en", label: t('settings.general.languageEn') },
                ]}
              />
            </div>
          </div>

          <Separator />

          {/* 2. Auto popup switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.general.autoPopup')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.general.autoPopupDesc')}
              </p>
            </div>
            <Switch
              checked={general.autoPopupOnSelection}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ autoPopupOnSelection: checked })
              }
            />
          </div>

          <Separator />

          {/* 3. Trigger Modifier */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.general.triggerModifier')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.general.triggerModifierDesc')}
              </p>
            </div>
            <div className="w-52">
              <Select
                value={general.triggerModifier}
                onChange={(val) =>
                  onUpdateGeneral({
                    triggerModifier: val as GeneralConfig["triggerModifier"],
                  })
                }
                options={[
                  { value: "None", label: t('settings.general.triggerModifierNone') },
                  { value: "Ctrl", label: t('settings.general.triggerModifierCtrl') },
                  { value: "Alt", label: t('settings.general.triggerModifierAlt') },
                  { value: "Shift", label: t('settings.general.triggerModifierShift') },
                ]}
              />
            </div>
          </div>

          <Separator />

          {/* 4. Min Selection Length */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.general.minSelectionLength')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.general.minSelectionLengthDesc')}
              </p>
            </div>
            <div className="w-52">
              <Input
                type="number"
                min={1}
                max={100}
                value={general.minSelectionLength}
                onChange={(e) =>
                  onUpdateGeneral({
                    minSelectionLength: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full text-right font-mono"
              />
            </div>
          </div>

          <Separator />

          {/* 5. Global Hotkey */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.general.globalHotkey')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.general.globalHotkeyDesc')}
              </p>
            </div>
            <div className="w-52">
              <Input
                type="text"
                value={general.globalHotkey}
                placeholder="例如: Alt+Space"
                onChange={(e) =>
                  onUpdateGeneral({ globalHotkey: e.target.value })
                }
                className="w-full font-mono text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* 6. Theme */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.general.theme')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.general.themeDesc')}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = rect.left + rect.width / 2;
                  const y = rect.top + rect.height / 2;
                  switchThemeWithTransition('system', x, y, () => onUpdateGeneral({ theme: 'system' }));
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                  general.theme === "system"
                    ? "bg-background text-foreground shadow-xs border border-black/5 dark:border-white/10 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
                title={t('settings.general.themeSystem')}
              >
                <Monitor size={13} className={general.theme === 'system' ? 'text-primary dark:text-blue-400' : ''} />
                <span>{isZh ? '系统' : 'System'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = rect.left + rect.width / 2;
                  const y = rect.top + rect.height / 2;
                  switchThemeWithTransition('light', x, y, () => onUpdateGeneral({ theme: 'light' }));
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                  general.theme === "light"
                    ? "bg-background text-foreground shadow-xs border border-black/5 dark:border-white/10 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
                title={t('settings.general.themeLight')}
              >
                <Sun size={13} className={general.theme === 'light' ? 'text-amber-500' : ''} />
                <span>{isZh ? '浅色' : 'Light'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = rect.left + rect.width / 2;
                  const y = rect.top + rect.height / 2;
                  switchThemeWithTransition('dark', x, y, () => onUpdateGeneral({ theme: 'dark' }));
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                  general.theme === "dark"
                    ? "bg-background text-foreground shadow-xs border border-black/5 dark:border-white/10 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                )}
                title={t('settings.general.themeDark')}
              >
                <Moon size={13} className={general.theme === 'dark' ? 'text-purple-500 dark:text-purple-400' : ''} />
                <span>{isZh ? '深色' : 'Dark'}</span>
              </button>
            </div>
          </div>

          <Separator />

          {/* 7. Overlay Opacity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.general.overlayOpacity')}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {t('settings.general.overlayOpacityDesc')}
                </p>
              </div>
              <div className="w-52 flex items-center gap-3">
                <Slider
                  min={50}
                  max={100}
                  step={1}
                  value={general.overlayOpacity ?? 90}
                  onChange={(val) => onUpdateGeneral({ overlayOpacity: val })}
                  className="flex-1"
                />
                <span className="w-9 text-right text-xs font-mono text-muted-foreground font-semibold">
                  {general.overlayOpacity ?? 90}%
                </span>
              </div>
            </div>

            {/* 实时微缩毛玻璃对比展台 */}
            <div className="relative rounded-xl p-3 overflow-hidden border border-border/50 bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-purple-500/15 dark:from-blue-600/20 dark:via-indigo-600/20 dark:to-purple-600/20 select-none">
              <div className="relative z-10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-medium text-muted-foreground">
                    {isZh ? `效果实时预览 (当前不透明度 ${general.overlayOpacity ?? 90}%)` : `Live Preview (Opacity ${general.overlayOpacity ?? 90}%)`}
                  </span>
                  <span className="text-[10px] text-muted-foreground/80">
                    {isZh ? "毛玻璃高斯模糊已联动" : "Linked with blur effects"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                  {/* 1. 微缩胶囊气泡 */}
                  <div className="capsule-glass h-7 px-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1.5 shadow-sm">
                    <IOXLogo size={16} />
                    <span className="text-[11px] font-medium text-foreground">{isZh ? "气泡透明度" : "Bubble Opacity"}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                      <Sparkles size={10} />
                      <span>AI</span>
                    </span>
                  </div>

                  {/* 2. 微缩卡片透光效果 */}
                  <div className="flex-1 min-w-[180px] bg-[var(--bg-overlay-card)] backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground border-b border-border/40 pb-1 mb-1">
                      <span className="font-medium text-foreground">AI Result Card</span>
                      <span>Markdown</span>
                    </div>
                    <p className="text-[10.5px] text-foreground/90 line-clamp-1">
                      {isZh ? "透明度调节实时生效，背景磨砂透光清晰自然。" : "Opacity changes take effect immediately with clear frosted glass."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 8. Floating Ball Controls */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.general.enableFloatingBall')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.general.enableFloatingBallDesc')}
              </p>
            </div>
            <Switch
              checked={general.enableFloatingBall ?? true}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ enableFloatingBall: checked })
              }
            />
          </div>

          {(general.enableFloatingBall ?? true) && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs text-foreground font-medium">
                    {t('settings.general.floatingBallAutoHide')}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('settings.general.floatingBallAutoHideDesc')}
                  </p>
                </div>
                <Switch
                  checked={general.floatingBallAutoHide ?? true}
                  onCheckedChange={(checked) =>
                    onUpdateGeneral({ floatingBallAutoHide: checked })
                  }
                />
              </div>
            </>
          )}

          <Separator />

          {/* 9. Auto Start */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.general.autoStart')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.general.autoStartDesc')}
              </p>
            </div>
            <Switch
              checked={general.autoStart || false}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ autoStart: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
