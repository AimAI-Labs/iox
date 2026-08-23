import React, { useState, useRef } from "react";
import { ChevronsUpDown } from "lucide-react";
import { ActionConfig, ProviderConfig, GeneralConfig } from "@/types/config";
import { Button } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { BubbleLivePreview } from "./BubbleLivePreview";
import { ActionPresetMenu } from "./ActionPresetMenu";
import { ActionCardItem } from "./ActionCardItem";

export interface ActionsTabProps {
  actions: ActionConfig[];
  providers: ProviderConfig[];
  general?: GeneralConfig;
  onUpdateGeneral?: (updated: Partial<GeneralConfig>) => void;
  onAddAction: (preset?: Partial<ActionConfig> & { defaultIdPrefix?: string }) => void;
  onUpdateAction: (id: string, updated: Partial<ActionConfig>) => void;
  onRemoveAction: (id: string) => void;
  onReorderActions: (newActions: ActionConfig[]) => void;
}

export const ActionsTab: React.FC<ActionsTabProps> = ({
  actions,
  providers,
  general,
  onUpdateGeneral,
  onAddAction,
  onUpdateAction,
  onRemoveAction,
  onReorderActions,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(actions.map((a) => a.id))
  );
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"top" | "bottom" | null>(null);
  const [showPresetMenu, setShowPresetMenu] = useState(false);

  // 同步持有当前拖拽状态引用，防止高频 dragOver 事件中的闭包问题
  const draggingIdRef = useRef<string | null>(null);
  const dropPositionRef = useRef<"top" | "bottom" | null>(null);

  const allCollapsed =
    actions.length > 0 && actions.every((a) => collapsedIds.has(a.id));

  // 切换单个卡片折叠/展开
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

  // 全部折叠 / 全部展开
  const toggleAllCollapse = () => {
    if (allCollapsed) {
      setCollapsedIds(new Set());
    } else {
      setCollapsedIds(new Set(actions.map((a) => a.id)));
    }
  };

  // 拖拽手柄开始
  const handleDragStart = (e: React.DragEvent, actionId: string) => {
    draggingIdRef.current = actionId;
    setDraggedId(actionId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", actionId);
  };

  // 拖拽悬停：实时计算上半部/下半部插入线
  const handleDragOver = (e: React.DragEvent, actionId: string) => {
    if (draggingIdRef.current === null || draggingIdRef.current === actionId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const threshold = rect.top + rect.height / 2;
    const position: "top" | "bottom" = mouseY < threshold ? "top" : "bottom";

    if (dragOverId !== actionId || dropPosition !== position) {
      setDragOverId(actionId);
      setDropPosition(position);
      dropPositionRef.current = position;
    }
  };

  // 离开目标卡片
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

  // 拖拽结束
  const handleDragEnd = () => {
    draggingIdRef.current = null;
    dropPositionRef.current = null;
    setDraggedId(null);
    setDragOverId(null);
    setDropPosition(null);
  };

  // 拖拽放置与重排
  const handleDrop = (e: React.DragEvent, targetActionId: string) => {
    e.preventDefault();
    const srcId = draggingIdRef.current || e.dataTransfer.getData("text/plain");
    const pos = dropPositionRef.current || "bottom";

    if (!srcId || srcId === targetActionId) {
      handleDragEnd();
      return;
    }

    const srcIndex = actions.findIndex((a) => a.id === srcId);
    const dstIndex = actions.findIndex((a) => a.id === targetActionId);

    if (srcIndex !== -1 && dstIndex !== -1) {
      const newActions = [...actions];
      const [moved] = newActions.splice(srcIndex, 1);
      const insertIndex = pos === "bottom" ? (srcIndex < dstIndex ? dstIndex : dstIndex + 1) : (srcIndex < dstIndex ? dstIndex - 1 : dstIndex);
      const clampedIndex = Math.max(0, Math.min(insertIndex, newActions.length));
      newActions.splice(clampedIndex, 0, moved);
      onReorderActions(newActions);
    }

    handleDragEnd();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-3">
      {/* 顶部标题栏与添加按钮 */}
      <div className="flex items-center justify-between pb-1 border-b border-border/30 shrink-0">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {t('settings.actions.title')} ({actions.length})
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isZh
              ? "配置悬浮气泡中的 AI 动作、Web 官网直达与快捷复制，支持按住手柄自由排序"
              : "Configure AI card actions, Web AI hub links, and copy tools in bubble bar"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {actions.length > 1 && (
            <Button
              onClick={toggleAllCollapse}
              size="sm"
              variant="outline"
              className="gap-1 text-xs px-2 h-8 border-border/80 hover:border-primary/50 cursor-pointer"
              title={allCollapsed ? (isZh ? "展开所有动作卡片" : "Expand All") : (isZh ? "折叠所有动作卡片" : "Collapse All")}
            >
              <ChevronsUpDown size={12} />
              <span>{allCollapsed ? (isZh ? "全部展开" : "Expand All") : (isZh ? "全部折叠" : "Collapse All")}</span>
            </Button>
          )}

          <ActionPresetMenu
            isOpen={showPresetMenu}
            onToggle={() => setShowPresetMenu((prev) => !prev)}
            onClose={() => setShowPresetMenu(false)}
            onSelectPreset={onAddAction}
          />
        </div>
      </div>

      {/* 顶部气泡条动态交互预览展台 */}
      <div className="shrink-0">
        <BubbleLivePreview
          actions={actions}
          general={general}
          onUpdateGeneral={onUpdateGeneral}
          onReorderActions={onReorderActions}
        />
      </div>

      {/* 动作卡片列表区 */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 no-scrollbar">
        {actions.map((action, index) => (
          <ActionCardItem
            key={action.id}
            action={action}
            index={index}
            providers={providers}
            isCollapsed={collapsedIds.has(action.id)}
            isDragging={draggedId === action.id}
            isDragOver={dragOverId === action.id}
            dropPosition={dragOverId === action.id ? dropPosition : null}
            onToggleCollapse={() => toggleCollapse(action.id)}
            onUpdate={(updated) => onUpdateAction(action.id, updated)}
            onRemove={() => onRemoveAction(action.id)}
            onDragStart={(e) => handleDragStart(e, action.id)}
            onDragOver={(e) => handleDragOver(e, action.id)}
            onDragLeave={(e) => handleDragLeave(e, action.id)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, action.id)}
          />
        ))}
      </div>
    </div>
  );
};
