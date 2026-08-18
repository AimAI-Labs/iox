import React from "react";
import { Plus, Trash2, Bot, Globe, Cpu, Copy, Eye } from "lucide-react";
import { ActionConfig, ActionType, ProviderConfig } from "@/types/config";
import { DynamicIcon } from "@/components/Icons";
import { BubbleBar } from "@/components/overlay";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface ActionsTabProps {
  actions: ActionConfig[];
  providers: ProviderConfig[];
  onAddAction: () => void;
  onUpdateAction: (id: string, updated: Partial<ActionConfig>) => void;
  onRemoveAction: (id: string) => void;
}

export const ActionsTab: React.FC<ActionsTabProps> = ({
  actions,
  providers,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
}) => {
  const enabledCount = actions.filter((a) => a.enabled).length;

  return (
    <div className="flex flex-col h-full overflow-hidden gap-3.5">
      {/* 顶部固定区域：Header + 实时预览展台 */}
      <div className="shrink-0 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-border/30">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              动作管理与模板
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              配置划词气泡上展示的 AI 动作、Prompt 提示词及网页直达/内嵌卡片规则
            </p>
          </div>
          <Button
            onClick={onAddAction}
            size="sm"
            variant="outline"
            className="gap-1 text-xs border-border/80 hover:border-primary/50"
          >
            <Plus size={13} />
            <span>添加动作</span>
          </Button>
        </div>

        {/* 胶囊条实时效果预览展台 (固定不随滚轮滚动) */}
        <div className="relative flex flex-col items-center justify-center py-4 px-4 rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 via-muted/20 to-muted/5 shadow-xs overflow-hidden">
          {/* 左上角说明徽标 */}
          <div className="absolute top-2.5 left-3.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/80">
            <Eye size={12} className="text-primary/70" />
            <span>划词气泡实时预览</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono ml-0.5 leading-none">
              {enabledCount} 项已启用
            </span>
          </div>

          {/* 胶囊居中展示区域 */}
          <div className="w-full flex items-center justify-center pt-3.5 pb-0.5 min-h-[40px]">
            {enabledCount > 0 ? (
              <BubbleBar
                actions={actions}
                selectedText="IOX 划词助手"
                isPreview={true}
                onActionClick={() => {}}
              />
            ) : (
              <div className="text-xs text-muted-foreground/60 italic flex items-center gap-1 py-1">
                <span>未启用任何动作，请在下方勾选启用至少一个动作以预览气泡</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Cards (独立滚动区域) */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 -mr-1.5">
        {actions.map((act) => (
          <Card
            key={act.id}
            className="group border-border/60 bg-card/60 hover:border-border/90 transition-all"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2.5 px-3.5 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <DynamicIcon name={act.icon} size={13} />
                </div>
                <Input
                  type="text"
                  value={act.name}
                  onChange={(e) =>
                    onUpdateAction(act.id, { name: e.target.value })
                  }
                  className="h-6 w-40 font-semibold text-xs bg-transparent border-transparent hover:border-border/60 focus-visible:bg-background/80 px-1.5"
                  placeholder="动作名称"
                />
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 font-mono">
                  {act.actionType === "api"
                    ? "API 流式"
                    : act.actionType === "web"
                    ? "Web 浮窗"
                    : "快捷复制"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor={`act-enable-${act.id}`} className="text-[11px]">
                    启用
                  </Label>
                  <Switch
                    id={`act-enable-${act.id}`}
                    checked={act.enabled}
                    onCheckedChange={(checked) =>
                      onUpdateAction(act.id, { enabled: checked })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveAction(act.id)}
                  className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                  title="删除此动作"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Action Type */}
                <div className="space-y-1.5">
                  <Label>动作类型</Label>
                  <Select
                    value={act.actionType}
                    onChange={(val) =>
                      onUpdateAction(act.id, {
                        actionType: val as ActionType,
                      })
                    }
                    options={[
                      {
                        value: "api",
                        label: "API 流式卡片",
                        icon: Bot,
                        description: "原地逐字流式渲染",
                      },
                      {
                        value: "web",
                        label: "Web 官网浮窗",
                        icon: Globe,
                        description: "原生 Webview 浮窗访问官网",
                      },
                      {
                        value: "copy",
                        label: "快捷复制",
                        icon: Copy,
                        description: "直接复制选中文本至剪贴板",
                      },
                    ]}
                  />
                </div>

                {/* Lucide Icon */}
                <div className="space-y-1.5">
                  <Label>Lucide 图标名</Label>
                  <div className="relative">
                    <Input
                      type="text"
                      value={act.icon}
                      placeholder="Sparkles, Bot, Globe, Languages..."
                      onChange={(e) =>
                        onUpdateAction(act.id, { icon: e.target.value })
                      }
                      className="pr-8"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <DynamicIcon name={act.icon} size={13} />
                    </div>
                  </div>
                </div>
              </div>

              {act.actionType === "api" ? (
                <>
                  {/* Provider Binding */}
                  <div className="space-y-1.5">
                    <Label>绑定模型服务商</Label>
                    <Select
                      value={act.providerId || ""}
                      onChange={(val) =>
                        onUpdateAction(act.id, { providerId: val })
                      }
                      options={providers.map((p) => ({
                        value: p.id,
                        label: p.name,
                        icon: Cpu,
                        description: `默认: ${p.defaultModel}`,
                      }))}
                    />
                  </div>

                  {/* Prompt Template */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Prompt 提示词模板</Label>
                      <span className="text-[10px] text-muted-foreground">
                        使用 <code className="bg-muted px-1 rounded font-mono">{"{text}"}</code> 代表划选内容
                      </span>
                    </div>
                    <Textarea
                      rows={3}
                      value={act.promptTemplate || ""}
                      placeholder="请翻译以下内容为中文：&#10;&#10;{text}"
                      onChange={(e) =>
                        onUpdateAction(act.id, { promptTemplate: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Web URL Template */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>URL 网址与参数模板</Label>
                      <span className="text-[10px] text-muted-foreground">
                        支持 <code className="bg-muted px-1 rounded font-mono">{"{text}"}</code> 传参
                      </span>
                    </div>
                    <Input
                      type="text"
                      value={act.urlTemplate || ""}
                      placeholder="https://tongyi.aliyun.com/qianwen/?q={text}"
                      onChange={(e) =>
                        onUpdateAction(act.id, { urlTemplate: e.target.value })
                      }
                    />
                  </div>

                  {/* Copy to Clipboard option */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/30">
                    <div className="space-y-0.5">
                      <Label className="text-xs text-foreground cursor-pointer">
                        自动复制划选文本到剪贴板
                      </Label>
                      <p className="text-[10px] text-muted-foreground">
                        打开网页前将划选内容写入剪贴板（便于在不支持 URL 传参的官网中直接粘贴）
                      </p>
                    </div>
                    <Switch
                      checked={act.copyToClipboard || false}
                      onCheckedChange={(checked) =>
                        onUpdateAction(act.id, { copyToClipboard: checked })
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
