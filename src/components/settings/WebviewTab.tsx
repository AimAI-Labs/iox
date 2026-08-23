import React, { useState, useEffect } from "react";
import { Globe, LayoutGrid, Layers, RefreshCcw, ArrowUpRight, Zap } from "lucide-react";
import { GeneralConfig, ActionConfig, WebWindowMode } from "@/types/config";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Card,
  CardContent,
  Label,
  Select,
  Switch,
  Button,
  Input,
  Separator,
} from "@/components/ui";
import { DynamicIcon } from "@/components/Icons";

interface WebviewTabProps {
  general: GeneralConfig;
  actions: ActionConfig[];
  onUpdateGeneral: (updated: Partial<GeneralConfig>) => void;
  onNavigateToActions?: () => void;
}

export const WebviewTab: React.FC<WebviewTabProps> = ({
  general,
  actions,
  onUpdateGeneral,
  onNavigateToActions,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  const [currentW, currentH] = general.webWindowSize || [860, 640];
  const webActions = actions.filter((a) => a.actionType === "web");
  const enabledWebActionsCount = webActions.filter((a) => a.enabled).length;

  const [widthInput, setWidthInput] = useState(String(Math.round(currentW)));
  const [heightInput, setHeightInput] = useState(String(Math.round(currentH)));

  // 当外部配置改变时（如拖拽调整窗口大小），同步更新输入框
  useEffect(() => {
    setWidthInput(String(Math.round(currentW)));
    setHeightInput(String(Math.round(currentH)));
  }, [currentW, currentH]);

  const commitSizeChange = () => {
    let w = parseInt(widthInput, 10);
    let h = parseInt(heightInput, 10);
    if (isNaN(w) || w < 400) w = 400;
    if (w > 2560) w = 2560;
    if (isNaN(h) || h < 300) h = 300;
    if (h > 1600) h = 1600;

    setWidthInput(String(w));
    setHeightInput(String(h));

    if (w !== Math.round(currentW) || h !== Math.round(currentH)) {
      onUpdateGeneral({ webWindowSize: [w, h] });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitSizeChange();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleResetSize = () => {
    setWidthInput("860");
    setHeightInput("640");
    onUpdateGeneral({ webWindowSize: [860, 640] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Globe size={16} className="text-blue-500" />
          <span>{t('settings.web.title')}</span>
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isZh
            ? "管理 AI 官网内置浮窗的呈现模式、剪贴板交互、窗口记忆尺寸及 Web 动作直达"
            : "Manage Web Hub window modes, clipboard integration, remembered window sizes, and quick actions"}
        </p>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          {/* Web Window Mode */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.web.windowMode')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {isZh ? "选择点击 Web 官网动作时的窗口展现与实例复用机制" : "Select window presentation & instance reuse mechanism for Web actions"}
              </p>
            </div>
            <div className="w-56">
              <Select
                value={general.webWindowMode || "multi_window"}
                onChange={(val) =>
                  onUpdateGeneral({
                    webWindowMode: val as WebWindowMode,
                  })
                }
                options={[
                  {
                    value: "multi_window",
                    label: isZh ? "独立多窗口 (推荐)" : "Multi-Window (Recommended)",
                    icon: LayoutGrid,
                    description: isZh ? "同动作单例复用，支持多 AI 官网并排对比" : "Reusable singleton per action, side-by-side comparison",
                  },
                  {
                    value: "tabbed",
                    label: isZh ? "统一单窗口 (Hub)" : "Single Hub Window",
                    icon: Layers,
                    description: isZh ? "所有 Web 动作收拢在单一浮窗内集中切换" : "All Web actions consolidated into a unified tabbed window",
                  },
                ]}
              />
            </div>
          </div>

          <Separator />

          {/* Auto Copy On Web Action */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {isZh ? "触发 Web 动作时自动复制文本" : "Auto-Copy Text on Web Action"}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {isZh
                  ? "调用 Web 官网动作时，自动将划选文本写入剪贴板，方便网页加载后直接粘贴"
                  : "Automatically copy selected text to clipboard when triggering Web actions for easy pasting"}
              </p>
            </div>
            <Switch
              checked={general.autoCopyOnWebAction || false}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ autoCopyOnWebAction: checked })
              }
            />
          </div>

          <Separator />

          {/* Web Window Size & Reset */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {isZh ? "浮窗记忆尺寸与重置" : "Remembered Size & Reset"}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {isZh
                  ? "拖拽浮窗边框时系统会自动记住最新尺寸，亦可在此直接输入指定分辨率"
                  : "System automatically memorizes size when resized, or enter custom dimensions here"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] font-mono text-muted-foreground select-none pointer-events-none">
                  W
                </span>
                <Input
                  type="number"
                  min={400}
                  max={2560}
                  value={widthInput}
                  onChange={(e) => setWidthInput(e.target.value)}
                  onBlur={commitSizeChange}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-[72px] pl-6 pr-1 text-xs font-mono"
                  placeholder="860"
                />
              </div>

              <span className="text-xs text-muted-foreground select-none">×</span>

              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] font-mono text-muted-foreground select-none pointer-events-none">
                  H
                </span>
                <Input
                  type="number"
                  min={300}
                  max={1600}
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  onBlur={commitSizeChange}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-[72px] pl-6 pr-1 text-xs font-mono"
                  placeholder="640"
                />
              </div>

              <span className="text-[11px] text-muted-foreground mr-1 select-none">px</span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSize}
                className="h-7 text-xs gap-1 border-border/70 hover:border-primary/50 px-2 cursor-pointer"
                title={isZh ? "恢复至推荐默认尺寸 860 × 640" : "Reset to default size 860 × 640"}
              >
                <RefreshCcw size={11} />
                <span>{t('common.reset')}</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Web Actions Quick Overview */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-foreground font-medium">
                  {isZh ? "Web 官网动作概览" : "Web Actions Overview"}
                </Label>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 font-mono font-medium">
                  {isZh ? `${enabledWebActionsCount} / ${webActions.length} 已启用` : `${enabledWebActionsCount} / ${webActions.length} Enabled`}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isZh
                  ? "已配置的 Web 官网直达动作列表，支持自动 DOM 填入与免 API 登录会话复用"
                  : "List of configured Web AI actions with DOM injection & session reuse"}
              </p>
            </div>

            {onNavigateToActions && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToActions}
                className="h-7 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 gap-1 px-2 cursor-pointer"
              >
                <Zap size={12} />
                <span>{isZh ? "管理动作" : "Manage Actions"}</span>
                <ArrowUpRight size={12} />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {webActions.length > 0 ? (
              webActions.map((action) => {
                const isDomInject = !action.urlTemplate?.includes("{text}");
                return (
                  <div
                    key={action.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-background/80 flex items-center justify-center text-foreground border border-border/50 shrink-0">
                        <DynamicIcon name={action.icon} size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">
                          {action.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {isDomInject ? (isZh ? "智能 DOM 输入与自动提交" : "DOM Inject & Auto Submit") : (isZh ? "URL 传参模式" : "URL Query Mode")}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          action.enabled
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {action.enabled ? t('common.enabled') : t('common.disabled')}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 text-center py-4 text-xs text-muted-foreground">
                {isZh ? "暂未配置 Web 官网动作" : "No Web actions configured"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
