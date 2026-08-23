import React from "react";
import { ActionConfig, GeneralConfig } from "@/types/config";
import { BubbleBar } from "@/components/overlay";
import { Eye, Zap } from "lucide-react";
import { Switch } from "@/components/ui";
import { useTranslation } from "@/hooks/useTranslation";

interface BubbleLivePreviewProps {
  actions: ActionConfig[];
  general?: GeneralConfig;
  onUpdateGeneral?: (updated: Partial<GeneralConfig>) => void;
  onReorderActions: (newActions: ActionConfig[]) => void;
}

export const BubbleLivePreview: React.FC<BubbleLivePreviewProps> = ({
  actions,
  general,
  onUpdateGeneral,
  onReorderActions,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';
  const enabledCount = actions.filter((a) => a.enabled).length;

  return (
    <div className="rounded-xl border border-border/50 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-600/15 dark:via-indigo-600/15 dark:to-purple-600/15 p-3 space-y-2 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Eye size={13} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {isZh ? "悬浮气泡条（BubbleBar）动态预览" : "Bubble Bar Live Preview"}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1 font-mono">
            {isZh ? `(${enabledCount} 项已启用)` : `(${enabledCount} Enabled)`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 纯图标模式开关 */}
          {onUpdateGeneral && (
            <div className="flex items-center gap-1.5 bg-background/50 backdrop-blur-xs px-2 py-0.5 rounded-full border border-border/40">
              <span className="text-[11px] font-medium text-foreground">
                {t('settings.general.iconOnlyBubble')}
              </span>
              <Switch
                checked={general?.iconOnlyBubble ?? false}
                onCheckedChange={(checked) =>
                  onUpdateGeneral({ iconOnlyBubble: checked })
                }
              />
            </div>
          )}

          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {isZh ? "可直接在此按住拖拽图标调整物理顺序" : "Drag icons directly to reorder"}
          </span>
        </div>
      </div>

      {/* 居中渲染预览 BubbleBar */}
      <div className="py-2 flex items-center justify-center min-h-[44px] bg-background/40 dark:bg-background/20 rounded-lg border border-border/30 overflow-x-auto">
        <BubbleBar
          actions={actions}
          selectedText={isZh ? "划选的文本示例" : "Selected text sample"}
          onActionClick={() => {}}
          onReorderActions={onReorderActions}
          isPreview={true}
          iconOnly={general?.iconOnlyBubble}
        />
      </div>

      <div className="flex items-center justify-between text-[10.5px] text-muted-foreground px-0.5">
        <span className="flex items-center gap-1">
          <Zap size={11} className="text-amber-500" />
          <span>{isZh ? "点击单个动作图标即可直接复制或发起 AI 动作" : "Click action icon to trigger AI or copy"}</span>
        </span>
        <span>{isZh ? "按住左侧手柄可整体拖动，点击右侧 Logo 打开本设置" : "Drag left handle to move, click logo to open settings"}</span>
      </div>
    </div>
  );
};
