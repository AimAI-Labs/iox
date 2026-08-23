import React from "react";
import { ActionConfig } from "@/types/config";
import { Input, Label, Switch } from "@/components/ui";
import { Code, Globe, Sparkles, Link2 } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface WebActionFormProps {
  action: ActionConfig;
  onUpdate: (updated: Partial<ActionConfig>) => void;
}

export const WebActionForm: React.FC<WebActionFormProps> = ({
  action,
  onUpdate,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';
  const isUrlTemplateMode = action.useUrlTemplate === true;

  return (
    <div className="space-y-3 pt-1">
      {/* 1. 目标 URL */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <Globe size={13} className="text-blue-500" />
            <span>{isZh ? "目标网页 / AI 官网 URL" : "Target Webpage / AI URL"}</span>
          </Label>
          {isUrlTemplateMode && (
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
              title={isZh ? "追加 URL 参数占位符 ?q={text}" : "Append query parameter ?q={text}"}
            >
              <Code size={10} />
              <span>{"{text}"}</span>
            </button>
          )}
        </div>

        <Input
          type="text"
          value={action.urlTemplate || ""}
          placeholder={isUrlTemplateMode ? (isZh ? "例如: https://metaso.cn/?q={text}" : "e.g. https://www.google.com/search?q={text}") : (isZh ? "例如: https://tongyi.aliyun.com/qianwen/ 或 https://chat.deepseek.com/" : "e.g. https://chat.deepseek.com/")}
          onChange={(e) => onUpdate({ urlTemplate: e.target.value })}
          className="text-xs font-mono"
        />

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {isUrlTemplateMode ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <Link2 size={11} />
              <span>{isZh ? "● URL 传参直达模式 (选中文本自动编码拼接在 URL 中，仅在单击时生效)" : "● URL Query Mode (Selected text encoded in URL)"}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
              <Sparkles size={11} />
              <span>{isZh ? "● 智能受控组件注入模式 (页面加载完成后自动查找输入框填入并聚焦，支持双击引用)" : "● Controlled DOM Injection (Auto-fills inputs after page loads)"}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. 启用 URL 参数跳转模式开关 */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/15 border border-border/30">
        <div className="space-y-0.5">
          <Label className="text-xs flex items-center gap-1.5 font-medium">
            <Link2 size={12} className="text-primary" />
            <span>{t('settings.actions.useUrlTemplate')}</span>
          </Label>
          <p className="text-[10px] text-muted-foreground">
            {isZh
              ? "若目标站点原生支持 URL 查询（如部分搜索引擎），开启后将直接通过 URL 传参跳转；默认推荐关闭以采用更稳定的受控组件注入"
              : "Directly query via URL parameters if target site supports URL search queries"}
          </p>
        </div>
        <Switch
          checked={isUrlTemplateMode}
          onCheckedChange={(checked) => {
            onUpdate({ useUrlTemplate: checked });
          }}
        />
      </div>

      {/* 3. 智能 DOM 填入与受控组件配置 (常驻展示) */}
      <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/40">
        <div className="flex items-center justify-between pb-1 border-b border-border/30">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
            <Sparkles size={12} className="text-amber-500" />
            <span>{t('settings.actions.domSelector')}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] text-muted-foreground">{t('settings.actions.autoSubmit')}</Label>
            <Switch
              checked={action.autoSubmit ?? true}
              onCheckedChange={(checked) => onUpdate({ autoSubmit: checked })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 items-start">
          {/* 输入框选择器 */}
          <div className="space-y-1">
            <Label className="text-[11px]">{t('settings.actions.inputSelector')}</Label>
            <Input
              type="text"
              value={action.inputSelector || ""}
              placeholder={t('settings.actions.inputSelectorPlaceholder')}
              onChange={(e) => onUpdate({ inputSelector: e.target.value })}
              className="text-xs font-mono h-7"
            />
          </div>

          {/* 发送按钮选择器 */}
          <div className="space-y-1">
            <Label className="text-[11px]">{t('settings.actions.submitSelector')}</Label>
            <Input
              type="text"
              value={action.submitSelector || ""}
              placeholder={t('settings.actions.submitSelectorPlaceholder')}
              onChange={(e) => onUpdate({ submitSelector: e.target.value })}
              className="text-xs font-mono h-7"
            />
          </div>
        </div>
      </div>

      {/* 4. 自动写入剪贴板开关 */}
      <div className="flex items-center justify-between pt-1">
        <div className="space-y-0.5">
          <Label className="text-xs">{t('settings.actions.copyToClipboard')}</Label>
          <p className="text-[10px] text-muted-foreground">
            {isZh
              ? "调起 Web 官网浮窗时，自动将划选的高亮内容写入剪贴板，方便手动粘贴补充"
              : "Automatically copy highlighted text to clipboard when opening Web hub"}
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
