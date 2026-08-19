import React, { useState, useRef, useEffect } from "react";
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
  Zap,
  ChevronDown,
} from "lucide-react";
import { ActionConfig, ActionType, ProviderConfig } from "@/types/config";
import { PRESET_ACTIONS } from "@/lib/presetActions";
import { DynamicIcon, POPULAR_AI_ICONS } from "@/components/Icons";
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
  onAddAction: (preset?: Partial<ActionConfig> & { defaultIdPrefix?: string }) => void;
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
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  // 同步持有当前拖拽状态，确保在密集拖拽事件中不丢帧、无闭包陈旧问题
  const draggingIdRef = React.useRef<string | null>(null);
  const dropPositionRef = React.useRef<'top' | 'bottom' | null>(null);

  // 点击外部关闭预设下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setShowPresetMenu(false);
      }
    };
    if (showPresetMenu) {
      document.addEventListener("pointerdown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [showPresetMenu]);

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

  // 拖拽悬停：实时计算鼠标位于卡片上半部还是下半部，精准计算插入位置
  const handleDragOver = (e: React.DragEvent, actionId: string) => {
    if (draggingIdRef.current === null || draggingIdRef.current === actionId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const threshold = rect.top + rect.height / 2;
    const position: 'top' | 'bottom' = mouseY < threshold ? 'top' : 'bottom';

    if (dragOverId !== actionId || dropPosition !== position) {
      setDragOverId(actionId);
      setDropPosition(position);
      dropPositionRef.current = position;
    }
  };

  // 拖拽离开当前卡片时重置目标指示（排除内部子元素冒泡）
  const handleDragLeave = (e: React.DragEvent, actionId: string) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as HTMLElement).contains(related)) {
      return;
    }
    if (dragOverId === actionId) {
      setDragOverId(null);
      setDropPosition(null);
      dropPositionRef.current = null;
    }
  };

  // 拖拽结束：清理所有 ref 与 state
  const handleDragEnd = () => {
    draggingIdRef.current = null;
    dropPositionRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    setDropPosition(null);
  };

  // 拖拽放置：精准根据 top/bottom 插入目标位置
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggingIdRef.current;
    const pos = dropPositionRef.current || dropPosition || 'bottom';

    if (sourceId === null || sourceId === targetId) {
      handleDragEnd();
      return;
    }

    const srcIndex = actions.findIndex((a) => a.id === sourceId);
    if (srcIndex === -1) {
      handleDragEnd();
      return;
    }

    const newActions = [...actions];
    const [moved] = newActions.splice(srcIndex, 1);
    let targetIndex = newActions.findIndex((a) => a.id === targetId);

    if (targetIndex !== -1) {
      if (pos === 'bottom') {
        targetIndex += 1;
      }
      newActions.splice(targetIndex, 0, moved);
      onReorderActions(newActions);
    }

    handleDragEnd();
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

            {/* 预设模板下拉菜单 */}
            <div className="relative" ref={presetMenuRef}>
              <Button
                onClick={() => setShowPresetMenu((prev) => !prev)}
                size="sm"
                variant="outline"
                className="gap-1 text-xs border-border/80 hover:border-primary/50 text-foreground h-7"
              >
                <Zap size={13} className="text-amber-500" />
                <span>预设模板</span>
                <ChevronDown size={11} className={cn("transition-transform duration-200", showPresetMenu && "rotate-180")} />
              </Button>

              {showPresetMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-72 max-h-[360px] overflow-y-auto rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-xl p-1.5 z-40 space-y-2 animate-in fade-in zoom-in-95 duration-100">
                  {/* 分组：Web 官网直达 */}
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      🌐 Web 官网直达 (URL传参)
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {PRESET_ACTIONS.filter((p) => p.category === "web").map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onAddAction(preset.template);
                            setShowPresetMenu(false);
                          }}
                          className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-accent/80 transition-colors group cursor-pointer"
                        >
                          <div className="mt-0.5 p-1 rounded-md bg-muted/60 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <DynamicIcon name={preset.template.icon} size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">
                              {preset.template.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate leading-tight">
                              {preset.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 分组：API 流式卡片 */}
                  <div className="border-t border-border/30 pt-1.5">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      🤖 API 流式卡片
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {PRESET_ACTIONS.filter((p) => p.category === "api").map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onAddAction(preset.template);
                            setShowPresetMenu(false);
                          }}
                          className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-accent/80 transition-colors group cursor-pointer"
                        >
                          <div className="mt-0.5 p-1 rounded-md bg-muted/60 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <DynamicIcon name={preset.template.icon} size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">
                              {preset.template.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate leading-tight">
                              {preset.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 分组：实用工具 */}
                  <div className="border-t border-border/30 pt-1.5">
                    <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      📋 实用工具
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {PRESET_ACTIONS.filter((p) => p.category === "utility").map((preset, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            onAddAction(preset.template);
                            setShowPresetMenu(false);
                          }}
                          className="w-full flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-accent/80 transition-colors group cursor-pointer"
                        >
                          <div className="mt-0.5 p-1 rounded-md bg-muted/60 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <DynamicIcon name={preset.template.icon} size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">
                              {preset.template.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate leading-tight">
                              {preset.description}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={() => onAddAction()}
              size="sm"
              variant="outline"
              className="gap-1 text-xs border-border/80 hover:border-primary/50 h-7"
            >
              <Plus size={13} />
              <span>自定义动作</span>
            </Button>
          </div>
        </div>

        {/* 胶囊条实时效果预览展台 (固定不随滚轮滚动) */}
        <div className="flex flex-col rounded-xl border border-border/70 bg-gradient-to-b from-muted/40 via-muted/20 to-muted/5 shadow-xs overflow-hidden">
          {/* 展台说明与状态头部 */}
          <div className="w-full flex items-center justify-between px-3.5 pt-2.5 pb-1.5 text-[11px] font-medium text-muted-foreground/80 select-none border-b border-border/30">
            <div className="flex items-center gap-1.5">
              <Eye size={13} className="text-primary/80" />
              <span className="font-semibold text-foreground/85">划词气泡实时预览</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono ml-0.5 leading-none font-normal">
                {enabledCount} 项已启用
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/60">可拖拽气泡内动作调整顺序</span>
          </div>

          {/* 胶囊居中展示区域 */}
          <div className="w-full flex items-center justify-center px-2 py-3 min-h-[46px] overflow-x-auto no-scrollbar">
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
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 -mr-1.5 py-1">
        {actions.map((act) => {
          const isCollapsed = collapsedIds.has(act.id);
          const isDragging = draggedId === act.id;
          const isDragOver = dragOverId === act.id && draggedId !== act.id;

          return (
            <div key={act.id} className="relative group/card-wrapper transition-transform duration-200 ease-out">
              {/* 顶部精准插入发光指示条 */}
              {isDragOver && dropPosition === 'top' && (
                <div className="absolute -top-2 left-0 right-0 z-30 pointer-events-none flex items-center gap-1.5 px-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/25 shadow-[0_0_10px_hsl(var(--primary))]" />
                  <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/80 to-transparent shadow-[0_0_8px_hsl(var(--primary))]" />
                </div>
              )}

              <Card
                onDragOver={(e) => handleDragOver(e, act.id)}
                onDragLeave={(e) => handleDragLeave(e, act.id)}
                onDragEnter={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, act.id)}
                className={cn(
                  "border-border/60 bg-card/70 overflow-hidden relative",
                  "transition-all duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
                  isDragging && [
                    "opacity-35 scale-[0.985] -rotate-[0.35deg]",
                    "border-dashed border-primary/70 bg-primary/5",
                    "shadow-none"
                  ],
                  isDragOver && [
                    "border-primary/80 ring-2 ring-primary/25",
                    "shadow-[0_4px_20px_-4px_rgba(59,130,246,0.22)]",
                    dropPosition === 'top' ? "translate-y-1.5" : "-translate-y-1.5"
                  ],
                  !isDragging && !isDragOver && "hover:border-border/90 hover:shadow-xs"
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
                        "flex items-center justify-center w-6 h-7 -ml-1 rounded-md",
                        "text-muted-foreground/50 hover:text-primary hover:bg-primary/10",
                        "cursor-grab active:cursor-grabbing select-none",
                        "transition-all duration-150 active:scale-90 hover:scale-105",
                        isDragging && "bg-primary/20 text-primary scale-105 ring-1 ring-primary/30"
                      )}
                      title="按住拖拽调整此动作排列顺序"
                    >
                      <GripVertical size={14} className="stroke-[2.2]" />
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

                      {/* 图标配置与快捷选取 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label>动作图标 (LobeHub AI / Lucide)</Label>
                          <span className="text-[10px] text-muted-foreground">
                            支持 AI 品牌名或 Lucide 图标
                          </span>
                        </div>
                        <div className="relative">
                          <Input
                            type="text"
                            value={act.icon}
                            placeholder="DeepSeek, OpenAI, Kimi, Claude, Qwen, Sparkles..."
                            onChange={(e) =>
                              onUpdateAction(act.id, { icon: e.target.value })
                            }
                            className="pr-8 h-8 text-xs font-mono"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none flex items-center justify-center">
                            <DynamicIcon name={act.icon} size={15} />
                          </div>
                        </div>

                        {/* 常用 AI 与功能图标快捷选择 */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {POPULAR_AI_ICONS.slice(0, 8).map((aiIcon) => (
                            <button
                              key={aiIcon.name}
                              type="button"
                              onClick={() => onUpdateAction(act.id, { icon: aiIcon.name })}
                              className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer",
                                act.icon.toLowerCase() === aiIcon.name.toLowerCase()
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border"
                              )}
                              title={aiIcon.label}
                            >
                              <DynamicIcon name={aiIcon.name} size={11} />
                              <span>{aiIcon.name}</span>
                            </button>
                          ))}
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
                            <Label>URL 网址与模板</Label>
                            <span className="text-[10px] text-muted-foreground">
                              {act.urlTemplate?.includes("{text}") ? (
                                <span className="text-primary font-medium">
                                  🔗 URL 传参模式 (
                                  <code className="bg-muted px-1 rounded font-mono">
                                    {"{text}"}
                                  </code>
                                  )
                                </span>
                              ) : (
                                <span className="text-amber-500 font-medium">
                                  🤖 DOM 智能注入模式
                                </span>
                              )}
                            </span>
                          </div>
                          <Input
                            type="text"
                            value={act.urlTemplate || ""}
                            placeholder="https://chat.deepseek.com/ 或 https://metaso.cn/?q={text}"
                            onChange={(e) =>
                              onUpdateAction(act.id, {
                                urlTemplate: e.target.value,
                              })
                            }
                          />
                        </div>

                        {/* DOM Injection Config (当 URL 不含 {text} 或已配置选择器时展示) */}
                        {!act.urlTemplate?.includes("{text}") && (
                          <div className="p-3 rounded-lg bg-muted/30 border border-border/40 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                智能 DOM 模拟填入与发送 (SPA 适配)
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                适用于 DeepSeek、Kimi 等无 URL 传参页面
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">
                                  输入框选择器 (CSS Selector)
                                </Label>
                                <Input
                                  type="text"
                                  className="h-8 text-xs font-mono"
                                  value={act.inputSelector || ""}
                                  placeholder="textarea#chat-input, textarea"
                                  onChange={(e) =>
                                    onUpdateAction(act.id, {
                                      inputSelector: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] text-muted-foreground">
                                  发送按钮选择器 (CSS Selector，可选)
                                </Label>
                                <Input
                                  type="text"
                                  className="h-8 text-xs font-mono"
                                  value={act.submitSelector || ""}
                                  placeholder="button[type='submit'], div[role='button']"
                                  onChange={(e) =>
                                    onUpdateAction(act.id, {
                                      submitSelector: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-border/20">
                              <div className="space-y-0.5">
                                <Label className="text-xs text-foreground cursor-pointer">
                                  填入后自动提交对话
                                </Label>
                                <p className="text-[10px] text-muted-foreground">
                                  注入文本后自动点击发送按钮或模拟 Enter 回车
                                </p>
                              </div>
                              <Switch
                                checked={act.autoSubmit ?? true}
                                onCheckedChange={(checked) =>
                                  onUpdateAction(act.id, {
                                    autoSubmit: checked,
                                  })
                                }
                              />
                            </div>
                          </div>
                        )}

                        {/* Copy to Clipboard option */}
                        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/30">
                          <div className="space-y-0.5">
                            <Label className="text-xs text-foreground cursor-pointer">
                              自动复制划选文本到剪贴板
                            </Label>
                            <p className="text-[10px] text-muted-foreground">
                              打开网页前将划选内容写入剪贴板（作为后备粘贴手段）
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

            {/* 底部精准插入发光指示条 */}
            {isDragOver && dropPosition === 'bottom' && (
              <div className="absolute -bottom-2 left-0 right-0 z-30 pointer-events-none flex items-center gap-1.5 px-2 animate-in fade-in zoom-in-95 duration-150">
                <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/25 shadow-[0_0_10px_hsl(var(--primary))]" />
                <div className="flex-1 h-[2px] rounded-full bg-gradient-to-r from-primary via-primary/80 to-transparent shadow-[0_0_8px_hsl(var(--primary))]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
};
