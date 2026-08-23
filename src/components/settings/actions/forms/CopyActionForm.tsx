import React from "react";
import { ActionConfig } from "@/types/config";
import { Copy, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface CopyActionFormProps {
  action: ActionConfig;
}

export const CopyActionForm: React.FC<CopyActionFormProps> = () => {
  const { resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  return (
    <div className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Copy size={13} className="text-primary" />
        <span>{isZh ? "快捷复制到系统剪贴板" : "Quick Copy to Clipboard"}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {isZh
          ? "点击此动作将直接把当前划选的高亮文本写入 Windows 系统剪贴板，并在胶囊气泡条上展示打勾成功微动效后自动平滑淡出。"
          : "Clicking this action instantly copies highlighted text to the clipboard and fades out with a checkmark micro-animation."}
      </p>
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium pt-1 border-t border-border/20">
        <ShieldCheck size={12} />
        <span>{isZh ? "无需网络请求与 API Token 消耗，即点即存" : "Zero network latency and no API token consumption"}</span>
      </div>
    </div>
  );
};
