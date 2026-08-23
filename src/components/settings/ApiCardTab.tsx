import React, { useState, useEffect } from "react";
import {
  Layers,
  Maximize2,
  Pin,
  Keyboard,
  BrainCircuit,
  Clock,
  Type,
  WrapText,
  ListOrdered,
  MessageSquareQuote,
  SendHorizontal,
  RefreshCcw,
  Sun,
  Moon,
  Monitor,
  Palette,
} from "lucide-react";
import { ApiCardConfig, ActionConfig, GeneralConfig } from "@/types/config";
import { switchThemeWithTransition } from "@/hooks/useTheme";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  Label,
  Select,
  Switch,
  Button,
  Input,
  Slider,
  Separator,
} from "@/components/ui";

interface ApiCardTabProps {
  apiCard: ApiCardConfig;
  actions: ActionConfig[];
  general?: GeneralConfig;
  onUpdateApiCard: (updated: Partial<ApiCardConfig>) => void;
  onUpdateGeneral?: (updated: Partial<GeneralConfig>) => void;
  onNavigateToActions?: () => void;
}

export const ApiCardTab: React.FC<ApiCardTabProps> = ({
  apiCard,
  general,
  onUpdateApiCard,
  onUpdateGeneral,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  const [currentW, currentH] = apiCard.cardSize || [600, 900];

  const [widthInput, setWidthInput] = useState(String(Math.round(currentW)));
  const [heightInput, setHeightInput] = useState(String(Math.round(currentH)));

  // 外部配置更新时同步
  useEffect(() => {
    setWidthInput(String(Math.round(currentW)));
    setHeightInput(String(Math.round(currentH)));
  }, [currentW, currentH]);

  const commitSizeChange = () => {
    let w = parseInt(widthInput, 10);
    let h = parseInt(heightInput, 10);
    if (isNaN(w) || w < 360) w = 360;
    if (w > 2560) w = 2560;
    if (isNaN(h) || h < 300) h = 300;
    if (h > 1600) h = 1600;

    setWidthInput(String(w));
    setHeightInput(String(h));

    if (w !== Math.round(currentW) || h !== Math.round(currentH)) {
      onUpdateApiCard({ cardSize: [w, h] });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitSizeChange();
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleResetSize = () => {
    setWidthInput("600");
    setHeightInput("900");
    onUpdateApiCard({ cardSize: [600, 900] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Layers size={16} className="text-primary dark:text-blue-400" />
          <span>{t('settings.apiCard.title')}</span>
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isZh
            ? "精细化管理流式结果卡片的窗口视窗、思考过程、排版代码与多轮追问交互"
            : "Fine-tune result card viewport, reasoning blocks, typography, and follow-up interaction"}
        </p>
      </div>

      {/* 1. 窗口外观主题与视窗卡片 */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <Maximize2 size={14} className="text-primary dark:text-blue-400" />
            <span className="text-xs font-semibold text-foreground">
              {isZh ? "窗口视窗与外观主题" : "Window Viewport & Theme"}
            </span>
          </div>

          {/* 外观主题切换 */}
          {general && onUpdateGeneral && (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Palette size={12} className="text-muted-foreground" />
                    <Label className="text-xs text-foreground font-medium">
                      {isZh ? "卡片外观色彩主题" : "Card Theme"}
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {isZh
                      ? "调整流式卡片与悬浮界面的色彩模式（深色 / 浅色 / 跟随系统）"
                      : "Adjust appearance theme mode (Light, Dark, or System)"}
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = rect.left + rect.width / 2;
                      const y = rect.top + rect.height / 2;
                      switchThemeWithTransition('system', x, y, () => onUpdateGeneral({ theme: 'system' }));
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                      general.theme === "system"
                        ? "bg-background text-foreground shadow-xs border border-black/5 dark:border-white/10 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                    title={t('settings.general.themeSystem')}
                  >
                    <Monitor size={13} className={general.theme === 'system' ? 'text-primary dark:text-blue-400' : ''} />
                    <span>{isZh ? '系统' : 'System'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = rect.left + rect.width / 2;
                      const y = rect.top + rect.height / 2;
                      switchThemeWithTransition('light', x, y, () => onUpdateGeneral({ theme: 'light' }));
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                      general.theme === "light"
                        ? "bg-background text-foreground shadow-xs border border-black/5 dark:border-white/10 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                    title={t('settings.general.themeLight')}
                  >
                    <Sun size={13} className={general.theme === 'light' ? 'text-amber-500' : ''} />
                    <span>{isZh ? '浅色' : 'Light'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = rect.left + rect.width / 2;
                      const y = rect.top + rect.height / 2;
                      switchThemeWithTransition('dark', x, y, () => onUpdateGeneral({ theme: 'dark' }));
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none",
                      general.theme === "dark"
                        ? "bg-background text-foreground shadow-xs border border-black/5 dark:border-white/10 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                    title={t('settings.general.themeDark')}
                  >
                    <Moon size={13} className={general.theme === 'dark' ? 'text-purple-500 dark:text-purple-400' : ''} />
                    <span>{isZh ? '深色' : 'Dark'}</span>
                  </button>
                </div>
              </div>

              <Separator />
            </>
          )}

          {/* 尺寸调节与重置 */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.apiCard.cardSize')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {isZh
                  ? "展开流式卡片时的默认宽高，在桌面拖拽右下角手柄缩放后将自动记忆"
                  : "Default width & height when opening result card; dragging corner handle memorizes new dimensions"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] font-mono text-muted-foreground select-none pointer-events-none">
                  W
                </span>
                <Input
                  type="number"
                  min={360}
                  max={2560}
                  value={widthInput}
                  onChange={(e) => setWidthInput(e.target.value)}
                  onBlur={commitSizeChange}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-[72px] pl-6 pr-1 text-xs font-mono"
                  placeholder="600"
                />
              </div>

              <span className="text-xs text-muted-foreground select-none">×</span>

              <div className="relative flex items-center">
                <span className="absolute left-2 text-[10px] font-mono text-muted-foreground select-none pointer-events-none">
                  H
                </span>
                <Input
                  type="number"
                  min={300}
                  max={1600}
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  onBlur={commitSizeChange}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-[72px] pl-6 pr-1 text-xs font-mono"
                  placeholder="900"
                />
              </div>

              <span className="text-[11px] text-muted-foreground mr-1 select-none">px</span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleResetSize}
                className="h-7 text-xs gap-1 border-border/70 hover:border-primary/50 px-2 cursor-pointer"
                title={isZh ? "恢复至推荐默认尺寸 600 × 900" : "Reset to default size 600 × 900"}
              >
                <RefreshCcw size={11} />
                <span>{t('common.reset')}</span>
              </Button>
            </div>
          </div>

          <Separator />

          {/* 默认自动固定 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Pin size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.autoPin')}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.autoPinDesc')}
              </p>
            </div>
            <Switch
              checked={apiCard.autoPinOnOpen ?? false}
              onCheckedChange={(checked) => onUpdateApiCard({ autoPinOnOpen: checked })}
            />
          </div>

          <Separator />

          {/* 自动获取键盘焦点 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Keyboard size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.autoFocus')}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.autoFocusDesc')}
              </p>
            </div>
            <Switch
              checked={apiCard.autoFocusInput ?? false}
              onCheckedChange={(checked) => onUpdateApiCard({ autoFocusInput: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. 思考过程与推理生成卡片 */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <BrainCircuit size={14} className="text-primary dark:text-blue-400" />
            <span className="text-xs font-semibold text-foreground">
              {isZh ? "思维链与推理生成" : "Chain of Thought & Reasoning"}
            </span>
          </div>

          {/* 思维链默认展开 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.apiCard.thinkingDefaultOpen')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.thinkingDefaultOpenDesc')}
              </p>
            </div>
            <Switch
              checked={apiCard.thinkingDefaultOpen ?? true}
              onCheckedChange={(checked) => onUpdateApiCard({ thinkingDefaultOpen: checked })}
            />
          </div>

          <Separator />

          {/* 思考完毕后自动折叠 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                {t('settings.apiCard.autoCollapseDone')}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.autoCollapseDoneDesc')}
              </p>
            </div>
            <Switch
              checked={apiCard.autoCollapseThinkingOnDone ?? true}
              onCheckedChange={(checked) =>
                onUpdateApiCard({ autoCollapseThinkingOnDone: checked })
              }
            />
          </div>

          <Separator />

          {/* 耗时统计 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.showDuration')}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.showDurationDesc')}
              </p>
            </div>
            <Switch
              checked={apiCard.showDuration ?? true}
              onCheckedChange={(checked) => onUpdateApiCard({ showDuration: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 3. 正文排版与代码块卡片 */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <Type size={14} className="text-primary dark:text-blue-400" />
            <span className="text-xs font-semibold text-foreground">
              {isZh ? "正文排版与代码块" : "Typography & Code Blocks"}
            </span>
          </div>

          {/* 正文字号调节 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.fontSize')}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {isZh
                    ? "调节卡片正文、段落及 Markdown 内容的全局显示比例"
                    : "Adjust font size for result card text and Markdown content"}
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-primary dark:text-blue-400">
                {apiCard.fontSize ?? 13} px
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground font-mono">12px</span>
              <Slider
                min={12}
                max={18}
                step={1}
                value={apiCard.fontSize ?? 13}
                onChange={(val) => onUpdateApiCard({ fontSize: val })}
                className="flex-1"
              />
              <span className="text-[11px] text-muted-foreground font-mono">18px</span>
            </div>

            {/* 字号微缩预览 */}
            <div
              className="p-2.5 rounded-lg border border-border/50 bg-black/5 dark:bg-white/5 text-foreground/90 transition-all select-none"
              style={{ fontSize: `${apiCard.fontSize ?? 13}px` }}
            >
              <span className="font-semibold text-primary dark:text-blue-400">
                {isZh ? "示例预览：" : "Preview: "}
              </span>
              {isZh ? "AI 流式卡片排版渲染效果，字号调节即时生效。" : "Live preview for AI result card typography rendering."}
            </div>
          </div>

          <Separator />

          {/* 代码块自动折行 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <WrapText size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.codeBlockWrap')}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.codeBlockWrapDesc')}
              </p>
            </div>
            <Switch
              checked={apiCard.codeBlockWrap ?? false}
              onCheckedChange={(checked) => onUpdateApiCard({ codeBlockWrap: checked })}
            />
          </div>

          <Separator />

          {/* 代码块显示行号 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <ListOrdered size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.codeBlockLineNumbers')}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.codeBlockLineNumbersDesc')}
              </p>
            </div>
            <Switch
              checked={apiCard.codeBlockLineNumbers ?? false}
              onCheckedChange={(checked) => onUpdateApiCard({ codeBlockLineNumbers: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 4. 多轮会话与追问快捷键卡片 */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <MessageSquareQuote size={14} className="text-primary dark:text-blue-400" />
            <span className="text-xs font-semibold text-foreground">
              {isZh ? "多轮会话与追问交互" : "Multi-Turn & Follow-up Interaction"}
            </span>
          </div>

          {/* 上下文轮数调节 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.contextTurns')}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {t('settings.apiCard.contextTurnsDesc')}
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-primary dark:text-blue-400">
                {isZh ? `最近 ${apiCard.contextTurns ?? 5} 轮` : `Last ${apiCard.contextTurns ?? 5} turns`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground font-mono">{isZh ? "1 轮" : "1 turn"}</span>
              <Slider
                min={1}
                max={10}
                step={1}
                value={apiCard.contextTurns ?? 5}
                onChange={(val) => onUpdateApiCard({ contextTurns: val })}
                className="flex-1"
              />
              <span className="text-[11px] text-muted-foreground font-mono">{isZh ? "10 轮" : "10 turns"}</span>
            </div>
          </div>

          <Separator />

          {/* 快捷发送按键 */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <SendHorizontal size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  {t('settings.apiCard.sendShortcut')}
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('settings.apiCard.sendShortcutDesc')}
              </p>
            </div>
            <div className="w-56">
              <Select
                value={apiCard.sendKeyShortcut ?? "Enter"}
                onChange={(val) =>
                  onUpdateApiCard({ sendKeyShortcut: val as "Enter" | "Ctrl+Enter" })
                }
                options={[
                  {
                    value: "Enter",
                    label: isZh ? "Enter 发送 / Shift+Enter 换行" : "Enter to Send / Shift+Enter for Newline",
                  },
                  {
                    value: "Ctrl+Enter",
                    label: isZh ? "Ctrl+Enter 发送 / Enter 换行" : "Ctrl+Enter to Send / Enter for Newline",
                  },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
