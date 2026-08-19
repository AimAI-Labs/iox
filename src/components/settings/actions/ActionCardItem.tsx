import React from "react";
import {
  Trash2,
  Bot,
  Globe,
  Copy,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { ActionConfig, ActionType, ProviderConfig } from "@/types/config";
import { DynamicIcon } from "@/components/Icons";
import {
  IconPicker,
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Label,
  Select,
  Switch,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { ApiActionForm } from "./forms/ApiActionForm";
import { WebActionForm } from "./forms/WebActionForm";
import { CopyActionForm } from "./forms/CopyActionForm";

interface ActionCardItemProps {
  action: ActionConfig;
  index?: number;
  providers: ProviderConfig[];
  isCollapsed: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  dropPosition: "top" | "bottom" | null;
  onToggleCollapse: () => void;
  onUpdate: (updated: Partial<ActionConfig>) => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent) => void;
}

export const ActionCardItem: React.FC<ActionCardItemProps> = ({
  action,
  providers,
  isCollapsed,
  isDragging,
  isDragOver,
  dropPosition,
  onToggleCollapse,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
}) => {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative transition-all duration-150 rounded-xl",
        isDragging && "opacity-30 scale-[0.98] border-2 border-dashed border-primary/60",
        isDragOver && dropPosition === "top" && "before:absolute before:-top-1.5 before:left-0 before:right-0 before:h-0.5 before:bg-primary before:rounded-full before:z-20 before:shadow-xs",
        isDragOver && dropPosition === "bottom" && "after:absolute after:-bottom-1.5 after:left-0 after:right-0 after:h-0.5 after:bg-primary after:rounded-full after:z-20 after:shadow-xs"
      )}
    >
      <Card
        className={cn(
          "border-border/60 bg-card/60 hover:border-border/90 transition-all",
          !action.enabled && "opacity-60 bg-muted/10 border-border/40"
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2.5 px-3.5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* 拖拽排序指示手柄 */}
            <div
              draggable
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              className="cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground p-0.5 rounded hover:bg-muted/60 transition-colors shrink-0"
              title="按住拖拽调整排序"
            >
              <GripVertical size={13} />
            </div>

            {/* 折叠/展开箭头 */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded hover:bg-muted/60 transition-colors shrink-0 cursor-pointer"
              title={isCollapsed ? "展开详情配置" : "折叠卡片"}
            >
              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>

            {/* 图标选择器 */}
            <IconPicker
              value={action.icon}
              onChange={(iconName: string) => onUpdate({ icon: iconName })}
              trigger={
                <div
                  className="flex items-center justify-center w-6 h-6 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary transition-all border border-border/60 cursor-pointer shadow-2xs"
                  title="点击更改图标"
                >
                  <DynamicIcon name={action.icon} size={14} />
                </div>
              }
            />

            {/* 动作名称编辑 */}
            <Input
              type="text"
              value={action.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="h-6 w-36 font-semibold text-xs bg-transparent border-transparent hover:border-border/60 focus-visible:bg-background/80 px-1.5"
              placeholder="动作名称"
            />

            {/* 动作类型标识 Badge */}
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded font-mono font-medium shrink-0",
                action.actionType === "api" && "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                action.actionType === "web" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
                action.actionType === "copy" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              )}
            >
              {action.actionType === "api" ? "API 流式" : action.actionType === "web" ? "Web 官网" : "复制"}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 启用/禁用 开关 */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground select-none">
                {action.enabled ? "已启用" : "已禁用"}
              </span>
              <Switch
                checked={action.enabled}
                onCheckedChange={(checked) => onUpdate({ enabled: checked })}
              />
            </div>

            {/* 删除按钮 */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
              title="删除此动作"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </CardHeader>

        {/* 卡片展开后的配置详情区 */}
        {!isCollapsed && (
          <CardContent className="p-3.5 space-y-3">
            {/* 动作核心调度类型选择 */}
            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="space-y-1.5">
                <Label>动作调度类型</Label>
                <Select
                  value={action.actionType}
                  onChange={(val) => {
                    const newType = val as ActionType;
                    const updates: Partial<ActionConfig> = { actionType: newType };
                    if (newType === "api" && !action.providerId) {
                      updates.providerId = providers[0]?.id || "deepseek";
                      updates.promptTemplate = action.promptTemplate || "请分析以下内容：\n\n{text}";
                    } else if (newType === "web" && !action.urlTemplate) {
                      updates.urlTemplate = "https://chat.deepseek.com/";
                    }
                    onUpdate(updates);
                  }}
                  options={[
                    { value: "api", label: "API 流式卡片模式 (原生展开)", icon: Bot },
                    { value: "web", label: "Web 官网原生浮窗 (免API登录)", icon: Globe },
                    { value: "copy", label: "快捷复制动作 (直接入剪贴板)", icon: Copy },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <Label>动作内部唯一 ID</Label>
                <Input
                  type="text"
                  readOnly
                  value={action.id}
                  className="text-xs font-mono bg-muted/30 text-muted-foreground cursor-default"
                />
              </div>
            </div>

            {/* 差异化子表单 */}
            {action.actionType === "api" && (
              <ApiActionForm
                action={action}
                providers={providers}
                onUpdate={onUpdate}
              />
            )}

            {action.actionType === "web" && (
              <WebActionForm
                action={action}
                onUpdate={onUpdate}
              />
            )}

            {action.actionType === "copy" && (
              <CopyActionForm
                action={action}
              />
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};
