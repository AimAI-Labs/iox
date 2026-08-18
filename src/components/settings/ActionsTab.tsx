import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionConfig, ProviderConfig } from "../../types/config";
import { DynamicIcon } from "../Icons";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";

interface ActionsTabProps {
  actions: ActionConfig[];
  providers: ProviderConfig[];
  onAddAction: () => void;
  onUpdateAction: (index: number, updated: Partial<ActionConfig>) => void;
  onRemoveAction: (index: number) => void;
}

export const ActionsTab: React.FC<ActionsTabProps> = ({
  actions,
  providers,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border/30">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            动作管理与模板
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            配置划词气泡上展示的 AI 动作、Prompt 提示词及网页直达规则
          </p>
        </div>
        <Button
          onClick={onAddAction}
          size="sm"
          variant="outline"
          className="gap-1 text-xs border-border/80 hover:border-primary/50"
        >
          <Plus size={13} />
          <span>新建动作</span>
        </Button>
      </div>

      {/* Action Cards */}
      <div className="space-y-3">
        {actions.map((act, idx) => (
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
                    onUpdateAction(idx, { name: e.target.value })
                  }
                  className="h-6 w-40 font-semibold text-xs bg-transparent border-transparent hover:border-border/60 focus-visible:bg-background/80 px-1.5"
                  placeholder="动作名称"
                />
                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 font-mono">
                  {act.actionType === "api" ? "API 流式" : "Web 网页"}
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
                      onUpdateAction(idx, { enabled: checked })
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveAction(idx)}
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
                    onChange={(e) =>
                      onUpdateAction(idx, {
                        actionType: e.target.value as "api" | "web",
                      })
                    }
                  >
                    <option value="api">API 流式卡片 (原地逐字渲染)</option>
                    <option value="web">Web 官网直达 (打开浏览器)</option>
                  </Select>
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
                        onUpdateAction(idx, { icon: e.target.value })
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
                      onChange={(e) =>
                        onUpdateAction(idx, { providerId: e.target.value })
                      }
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.defaultModel})
                        </option>
                      ))}
                    </Select>
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
                        onUpdateAction(idx, { promptTemplate: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Web URL Template */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>URL 跳转模板</Label>
                      <span className="text-[10px] text-muted-foreground">
                        支持 <code className="bg-muted px-1 rounded font-mono">{"{text}"}</code> 传参
                      </span>
                    </div>
                    <Input
                      type="text"
                      value={act.urlTemplate || ""}
                      placeholder="https://tongyi.aliyun.com/qianwen/?q={text}"
                      onChange={(e) =>
                        onUpdateAction(idx, { urlTemplate: e.target.value })
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
                        打开网页前将划选内容写入剪贴板（适用于不支持 URL 参数直接提问的 AI 官网）
                      </p>
                    </div>
                    <Switch
                      checked={act.copyToClipboard || false}
                      onCheckedChange={(checked) =>
                        onUpdateAction(idx, { copyToClipboard: checked })
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
