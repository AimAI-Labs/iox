import React from "react";
import { ActionConfig, ProviderConfig } from "@/types/config";
import { Input, Textarea, Label, Select } from "@/components/ui";
import { Box, Code } from "lucide-react";

interface ApiActionFormProps {
  action: ActionConfig;
  providers: ProviderConfig[];
  onUpdate: (updated: Partial<ActionConfig>) => void;
}

export const ApiActionForm: React.FC<ApiActionFormProps> = ({
  action,
  providers,
  onUpdate,
}) => {
  const currentProvider = providers.find((p) => p.id === action.providerId);
  const models = currentProvider?.models || [];

  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-3 items-start">
        {/* 服务商绑定 */}
        <div className="space-y-1.5">
          <Label>指定模型服务商</Label>
          <Select
            value={action.providerId || ""}
            onChange={(val) => onUpdate({ providerId: val })}
            options={providers.map((p) => ({
              value: p.id,
              label: p.name || p.id,
              icon: Box,
            }))}
          />
        </div>

        {/* 默认调用模型预览 */}
        <div className="space-y-1.5">
          <Label>当前服务商默认模型</Label>
          <Input
            type="text"
            readOnly
            value={currentProvider?.defaultModel || (models.length > 0 ? models[0] : "未选择服务商")}
            className="text-xs bg-muted/30 font-mono cursor-default text-muted-foreground"
          />
        </div>
      </div>

      {/* 提示词模板 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Prompt 提示词模板</Label>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">支持占位符:</span>
            <button
              type="button"
              onClick={() => {
                const cur = action.promptTemplate || "";
                if (!cur.includes("{text}")) {
                  onUpdate({ promptTemplate: cur ? `${cur}\n\n{text}` : "{text}" });
                }
              }}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer border border-primary/20"
              title="插入划选文本占位符 {text}"
            >
              <Code size={10} />
              <span>{"{text}"}</span>
            </button>
          </div>
        </div>

        <Textarea
          value={action.promptTemplate || ""}
          placeholder="输入 AI 提示词指令，使用 {text} 作为用户选中文本的替换位置..."
          rows={3}
          onChange={(e) => onUpdate({ promptTemplate: e.target.value })}
          className="text-xs font-mono resize-y min-h-[64px]"
        />
        <p className="text-[10px] text-muted-foreground">
          划词触发时，系统会自动将用户在任意窗口划选的高亮文本填入 <code className="text-primary font-mono">{"{text}"}</code> 所在位置并流式调用 API。
        </p>
      </div>
    </div>
  );
};
