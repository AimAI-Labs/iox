import React from "react";
import { ActionConfig } from "@/types/config";
import { Input, Label, Switch } from "@/components/ui";
import { Code, Globe, Sparkles } from "lucide-react";

interface WebActionFormProps {
  action: ActionConfig;
  onUpdate: (updated: Partial<ActionConfig>) => void;
}

export const WebActionForm: React.FC<WebActionFormProps> = ({
  action,
  onUpdate,
}) => {
  const isUrlTemplate = action.urlTemplate?.includes("{text}") || action.urlTemplate?.includes("{query}");

  return (
    <div className="space-y-3 pt-1">
      {/* 目标 URL 模板 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Globe size={13} className="text-blue-500" />
            <span>目标网页 / AI 官网 URL</span>
          </Label>
          <button
            type="button"
            onClick={() => {
              const cur = action.urlTemplate || "";
              if (!cur.includes("{text}")) {
                onUpdate({
                  urlTemplate: cur.includes("?") ? `${cur}&q={text}` : `${cur}?q={text}`,
                });
              }
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors cursor-pointer border border-blue-500/20"
            title="追加 URL 参数占位符 ?q={text}"
          >
            <Code size={10} />
            <span>{"{text}"}</span>
          </button>
        </div>

        <Input
          type="text"
          value={action.urlTemplate || ""}
          placeholder="例如: https://chat.deepseek.com/ 或 https://metaso.cn/?q={text}"
          onChange={(e) => onUpdate({ urlTemplate: e.target.value })}
          className="text-xs font-mono"
        />

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {isUrlTemplate ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span>● URL 传参直达模式</span>
              <span>(选中文本自动编码拼接在 URL 中)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
              <Sparkles size={11} />
              <span>智能 DOM 注入模式 (页面加载完成后自动查找输入框填入并可自动发送)</span>
            </span>
          )}
        </div>
      </div>

      {/* 智能 DOM 填入与自动提交配置 (非 URL 传参时展开) */}
      {!isUrlTemplate && (
        <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/40">
          <div className="flex items-center justify-between pb-1 border-b border-border/30">
            <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
              <Sparkles size={12} className="text-amber-500" />
              <span>SPA 官网智能注入与受控组件适配</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground">自动点击发送</Label>
              <Switch
                checked={action.autoSubmit ?? true}
                onCheckedChange={(checked) => onUpdate({ autoSubmit: checked })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 items-start">
            {/* 输入框选择器 */}
            <div className="space-y-1">
              <Label className="text-[11px]">输入框 CSS 选择器 (留空自动启发式探测)</Label>
              <Input
                type="text"
                value={action.inputSelector || ""}
                placeholder="例如: textarea#chat-input, textarea"
                onChange={(e) => onUpdate({ inputSelector: e.target.value })}
                className="text-xs font-mono h-7"
              />
            </div>

            {/* 发送按钮选择器 */}
            <div className="space-y-1">
              <Label className="text-[11px]">发送按钮 CSS 选择器 (可选)</Label>
              <Input
                type="text"
                value={action.submitSelector || ""}
                placeholder="例如: button[type='submit'], button.send"
                onChange={(e) => onUpdate({ submitSelector: e.target.value })}
                className="text-xs font-mono h-7"
              />
            </div>
          </div>
        </div>
      )}

      {/* 自动写入剪贴板开关 */}
      <div className="flex items-center justify-between pt-1">
        <div className="space-y-0.5">
          <Label className="text-xs">触发时同步复制选中文本到系统剪贴板</Label>
          <p className="text-[10px] text-muted-foreground">
            调起 Web 官网浮窗时，自动将划选的高亮内容写入剪贴板，方便手动粘贴补充
          </p>
        </div>
        <Switch
          checked={action.copyToClipboard || false}
          onCheckedChange={(checked) => onUpdate({ copyToClipboard: checked })}
        />
      </div>
    </div>
  );
};
