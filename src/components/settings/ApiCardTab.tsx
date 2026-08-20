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
} from "lucide-react";
import { ApiCardConfig, ActionConfig } from "@/types/config";
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
  onUpdateApiCard: (updated: Partial<ApiCardConfig>) => void;
  onNavigateToActions?: () => void;
}

export const ApiCardTab: React.FC<ApiCardTabProps> = ({
  apiCard,
  onUpdateApiCard,
}) => {
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
          <span>API 流式卡片设置</span>
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          精细化管理流式结果卡片的窗口视窗、思考过程、排版代码与多轮追问交互
        </p>
      </div>

      {/* 1. 窗口视窗与交互卡片 */}
      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/40">
            <Maximize2 size={14} className="text-primary dark:text-blue-400" />
            <span className="text-xs font-semibold text-foreground">窗口视窗与交互</span>
          </div>

          {/* 尺寸调节与重置 */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                默认卡片尺寸与记忆
              </Label>
              <p className="text-[11px] text-muted-foreground">
                展开流式卡片时的默认宽高，在桌面拖拽右下角手柄缩放后将自动记忆
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
                title="恢复至推荐默认尺寸 600 × 900"
              >
                <RefreshCcw size={11} />
                <span>重置</span>
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
                  展开时默认自动 Pin 固定
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                开启后，每次唤起 API 卡片均自动钉在桌面上，点击外部区域不会自动隐藏
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
                  展开时自动获取键盘焦点
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                开启后卡片展开时将主动聚焦追问输入框（注：会从宿主应用夺取焦点）
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
            <span className="text-xs font-semibold text-foreground">思维链与推理生成</span>
          </div>

          {/* 思维链默认展开 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                思维链生成中默认展开
              </Label>
              <p className="text-[11px] text-muted-foreground">
                检测到大模型包含 &lt;think&gt; 深度思考标签时，生成期间默认展开展示实时思考
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
                思考闭合后自动折叠
              </Label>
              <p className="text-[11px] text-muted-foreground">
                模型结束推理并输出正文后，平滑收起思维链面板，聚焦展示核心回答
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
                  显示生成与推理耗时统计
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                在对话状态栏与工具区显示回答所消耗的时间（如 for 3.2s）
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
            <span className="text-xs font-semibold text-foreground">正文排版与代码块</span>
          </div>

          {/* 正文字号调节 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground font-medium">
                  正文显示字号大小
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  调节卡片正文、段落及 Markdown 内容的全局显示比例
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
              <span className="font-semibold text-primary dark:text-blue-400">示例预览：</span>
              AI 流式卡片排版渲染效果，字号调节即时生效。
            </div>
          </div>

          <Separator />

          {/* 代码块自动折行 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <WrapText size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  代码块长行自动折行
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                开启时长代码行将自适应折行显示；关闭时长行保持横向平滑滚动
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
                  代码块显示行号
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                在代码高亮展示区域左侧渲染粘性代码行序号
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
            <span className="text-xs font-semibold text-foreground">多轮会话与追问交互</span>
          </div>

          {/* 上下文轮数调节 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground font-medium">
                  追问携带历史上下文深度
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  在流式卡片底部连续追问时，打包发送给大模型 API 的最近对话轮次
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-primary dark:text-blue-400">
                最近 {apiCard.contextTurns ?? 5} 轮
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground font-mono">1 轮</span>
              <Slider
                min={1}
                max={10}
                step={1}
                value={apiCard.contextTurns ?? 5}
                onChange={(val) => onUpdateApiCard({ contextTurns: val })}
                className="flex-1"
              />
              <span className="text-[11px] text-muted-foreground font-mono">10 轮</span>
            </div>
          </div>

          <Separator />

          {/* 快捷发送按键 */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <SendHorizontal size={12} className="text-muted-foreground" />
                <Label className="text-xs text-foreground font-medium">
                  追问输入框发送快捷键
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                选择回车直接发送还是使用组合键发送
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
                    label: "Enter 发送 / Shift+Enter 换行",
                  },
                  {
                    value: "Ctrl+Enter",
                    label: "Ctrl+Enter 发送 / Enter 换行",
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
