import React from "react";
import { Globe, LayoutGrid, Layers, RefreshCcw, ArrowUpRight, Zap } from "lucide-react";
import { GeneralConfig, ActionConfig, WebWindowMode } from "@/types/config";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  const [currentW, currentH] = general.webWindowSize || [860, 640];
  const webActions = actions.filter((a) => a.actionType === "web");
  const enabledWebActionsCount = webActions.filter((a) => a.enabled).length;

  const handleResetSize = () => {
    onUpdateGeneral({ webWindowSize: [860, 640] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Globe size={16} className="text-blue-500" />
          <span>Web 官网浮窗设置</span>
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          管理 AI 官网内置浮窗的呈现模式、剪贴板交互、窗口记忆尺寸及 Web 动作直达
        </p>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          {/* Web Window Mode */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                Web 官网浮窗模式
              </Label>
              <p className="text-[11px] text-muted-foreground">
                选择点击 Web 官网动作时的窗口展现与实例复用机制
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
                    label: "独立多窗口 (推荐)",
                    icon: LayoutGrid,
                    description: "同动作单例复用，支持多 AI 官网并排对比",
                  },
                  {
                    value: "tabbed",
                    label: "统一单窗口 (Hub)",
                    icon: Layers,
                    description: "所有 Web 动作收拢在单一浮窗内集中切换",
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
                触发 Web 动作时自动复制文本
              </Label>
              <p className="text-[11px] text-muted-foreground">
                调用 Web 官网动作时，自动将划选文本写入剪贴板，方便网页加载后直接粘贴
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
                浮窗记忆尺寸与重置
              </Label>
              <p className="text-[11px] text-muted-foreground">
                拖拽浮窗边框时系统会自动记住最新尺寸（当前记忆：{Math.round(currentW)} × {Math.round(currentH)} px）
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs font-mono text-muted-foreground px-2 py-1 bg-muted/40 rounded border border-border/40">
                {Math.round(currentW)} × {Math.round(currentH)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSize}
                className="h-7 text-xs gap-1 border-border/70 hover:border-primary/50"
                title="恢复至推荐默认尺寸 860 × 640"
              >
                <RefreshCcw size={11} />
                <span>重置为默认</span>
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
                  Web 官网动作概览
                </Label>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 font-mono font-medium">
                  {enabledWebActionsCount} / {webActions.length} 已启用
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                已配置的 Web 官网直达动作列表，支持自动 DOM 填入与免 API 登录会话复用
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
                <span>管理动作</span>
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
                          {isDomInject ? "智能 DOM 输入与自动提交" : "URL 传参模式"}
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
                        {action.enabled ? "启用" : "禁用"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 text-center py-4 text-xs text-muted-foreground">
                暂未配置 Web 官网动作
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
