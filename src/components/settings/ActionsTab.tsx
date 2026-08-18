import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Bot,
  Globe,
  Cpu,
  Copy,
  Eye,
  GripVertical,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

interface ActionsTabProps {
  actions: ActionConfig[];
  providers: ProviderConfig[];
  onAddAction: () => void;
  onUpdateAction: (id: string, updated: Partial<ActionConfig>) => void;
  onRemoveAction: (id: string) => void;
  onReorderActions: (newActions: ActionConfig[]) => void;
}

export const ActionsTab: React.FC<ActionsTabProps> = ({
  actions,
  providers,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
  onReorderActions,
}) => {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set(actions.map(a => a.id)));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  // 同步持有当前拖拽源 id：HTML5 拖拽事件间间隔极短，
  // setState 异步更新会让 dragOver/drop 闭包读到陈旧的 null。
  // 用 ref 在 onDragStart 内立刻写入，事件回调即可同步读取。
  const draggingIdRef = React.useRef<string | null>(null);

  const enabledCount = actions.filter((a) => a.enabled).length;
  const allCollapsed =
    actions.length > 0 && actions.every((a) => collapsedIds.has(a.id));

  // 切换单个折叠
  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 全部折叠 / 展开
  const toggleAllCollapse = () => {
    if (allCollapsed) {
      setCollapsedIds(new Set());
    } else {
      setCollapsedIds(new Set(actions.map((a) => a.id)));
    }
  };

  // 拖拽从手柄发起：同步写入 ref + 异步更新 state 用于视觉反馈
  const handleDragStart = (e: React.DragEvent, actionId: string) => {
    draggingIdRef.current = actionId;
    setDraggedId(actionId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", actionId);
  };

  // 拖拽悬停：使用 ref 同步判断，避免闭包陈旧导致 dropEffect 失效
  const handleDragOver = (e: React.DragEvent, actionId: string) => {
    if (draggingIdRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== actionId) {
      setDragOverId(actionId);
    }
  };

  // 拖拽结束：清理 ref + state
  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
  };

  // 拖拽放置：使用 ref 同步读取拖拽源
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggingIdRef.current;
    if (sourceId === null || sourceId === targetId) {
      draggingIdRef.current = null;
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const srcIndex = actions.findIndex((a) => a.id === sourceId);
    const dstIndex = actions.findIndex((a) => a.id === targetId);

    if (srcIndex !== -1 && dstIndex !== -1) {
      const newActions = [...actions];
      const [moved] = newActions.splice(srcIndex, 1);
      newActions.splice(dstIndex, 0, moved);
      onReorderActions(newActions);
    }

    draggingIdRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
  };

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
              配置划词气泡上展示的 AI 动作，支持拖拽排序与展开/折叠
            </p>
          </div>
          <div className="flex items-center gap-2">
            {actions.length > 0 && (
              <Button
                onClick={toggleAllCollapse}
                size="sm"
                variant="ghost"
                className="gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                title={allCollapsed ? "展开全部动作" : "折叠全部动作"}
              >
                <ChevronsUpDown size={13} />
                <span>{allCollapsed ? "全部展开" : "全部折叠"}</span>
              </Button>
            )}
            <Button
              onClick={onAddAction}
              size="sm"
              variant="outline"
              className="gap-1 text-xs border-border/80 hover:border-primary/50 h-7"
            >
              <Plus size={13} />
              <span>添加动作</span>
            </Button>
          </div>
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
                onReorderActions={onReorderActions}
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

      {/* Action Cards (独立滚动区域 + 支持拖拽排序) */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 -mr-1.5">
        {actions.map((act) => {
          const isCollapsed = collapsedIds.has(act.id);
          const isDragging = draggedId === act.id;
          const isDragOver = dragOverId === act.id && draggedId !== act.id;

          return (
            <Card
              key={act.id}
              onDragOver={(e) => handleDragOver(e, act.id)}
              onDragEnter={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, act.id)}
              className={cn(
                "group border-border/60 bg-card/60 transition-all duration-150 overflow-hidden",
                isDragging && "opacity-35 scale-[0.98] border-dashed border-primary shadow-none",
                isDragOver && "border-primary ring-2 ring-primary/30 translate-y-0.5",
                !isDragging && !isDragOver && "hover:border-border/90"
              )}
            >
              <CardHeader
                className="flex flex-row items-center justify-between space-y-0 py-2 px-3 bg-muted/20 select-none border-b-0"
              >
                <div className="flex items-center gap-1.5">
                  {/* 专属拖拽把手 (按住启动卡片拖拽) */}
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, act.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center justify-center w-6 h-7 -ml-1 rounded",
                      "text-muted-foreground/60 hover:text-foreground hover:bg-muted/60",
                      "cursor-grab active:cursor-grabbing select-none",
                      "transition-colors",
                      isDragging && "bg-primary/15 text-primary"
                    )}
                    title="按住拖拽调整此动作排列顺序"
                  >
                    <GripVertical size={14} />
                  </div>

                  {/* 折叠/展开切换按钮 */}
                  <button
                    type="button"
                    onClick={() => toggleCollapse(act.id)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title={isCollapsed ? "展开配置详情" : "折叠配置详情"}
                  >
                    <ChevronRight
                      size={13}
                      className={cn(
                        "transition-transform duration-200 ease-out",
                        !isCollapsed && "rotate-90 text-primary"
                      )}
                    />
                  </button>

                  {/* 动作图标 */}
                  <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <DynamicIcon name={act.icon} size={13} />
                  </div>

                  {/* 动作名称 */}
                  <Input
                    type="text"
                    value={act.name}
                    onChange={(e) =>
                      onUpdateAction(act.id, { name: e.target.value })
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 w-36 font-semibold text-xs bg-transparent border-transparent hover:border-border/60 focus-visible:bg-background/80 px-1.5"
                    placeholder="动作名称"
                  />

                  {/* 动作类型徽章 */}
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 font-mono">
                    {act.actionType === "api"
                      ? "API 流式"
                      : act.actionType === "web"
                      ? "Web 浮窗"
                      : "快捷复制"}
                  </span>
                </div>

                {/* 右侧操作区 */}
                <div
                  className="flex items-center gap-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <Label
                      htmlFor={`act-enable-${act.id}`}
                      className="text-[11px] text-muted-foreground cursor-pointer"
                    >
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
                    className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 h-6 w-6"
                    title="删除此动作"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </CardHeader>

              {/* 卡片展开内容 (丝滑折叠展开动效) */}
              <div
                className={cn(
                  "card-collapse-wrapper",
                  isCollapsed && "is-collapsed"
                )}
              >
                <div className="card-collapse-inner">
                  <CardContent className="p-3.5 space-y-3 border-t border-border/40">
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
                              使用{" "}
                              <code className="bg-muted px-1 rounded font-mono">
                                {"{text}"}
                              </code>{" "}
                              代表划选内容
                            </span>
                          </div>
                          <Textarea
                            rows={3}
                            value={act.promptTemplate || ""}
                            placeholder="请翻译以下内容为中文：&#10;&#10;{text}"
                            onChange={(e) =>
                              onUpdateAction(act.id, {
                                promptTemplate: e.target.value,
                              })
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
                              支持{" "}
                              <code className="bg-muted px-1 rounded font-mono">
                                {"{text}"}
                              </code>{" "}
                              传参
                            </span>
                          </div>
                          <Input
                            type="text"
                            value={act.urlTemplate || ""}
                            placeholder="https://tongyi.aliyun.com/qianwen/?q={text}"
                            onChange={(e) =>
                              onUpdateAction(act.id, {
                                urlTemplate: e.target.value,
                              })
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
                              onUpdateAction(act.id, {
                                copyToClipboard: checked,
                              })
                            }
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
