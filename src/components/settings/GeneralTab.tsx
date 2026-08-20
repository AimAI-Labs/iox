import React, { useState, useEffect } from "react";
import { Monitor, Moon, Sun, Sparkles, RefreshCcw } from "lucide-react";
import { GeneralConfig } from "@/types/config";
import {
  Card,
  CardContent,
  Input,
  Label,
  Select,
  Slider,
  Switch,
  Separator,
  Button,
} from "@/components/ui";
import { IOXLogo } from "@/components/common";

interface GeneralTabProps {
  general: GeneralConfig;
  onUpdateGeneral: (updated: Partial<GeneralConfig>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  general,
  onUpdateGeneral,
}) => {
  const [currentW, currentH] = general.apiCardSize || [600, 900];
  const [widthInput, setWidthInput] = useState(String(Math.round(currentW)));
  const [heightInput, setHeightInput] = useState(String(Math.round(currentH)));

  // 当外部配置改变时，同步更新输入框
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
      onUpdateGeneral({ apiCardSize: [w, h] });
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
    onUpdateGeneral({ apiCardSize: [600, 900] });
  };
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          划词触发与常规设置
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          调整系统级取词逻辑、快捷键、界面外观与开机自启动
        </p>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          {/* Auto popup switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                划选文本自动弹出
              </Label>
              <p className="text-[11px] text-muted-foreground">
                在任意应用中选中文本后，在光标旁即时弹出微型胶囊操作条
              </p>
            </div>
            <Switch
              checked={general.autoPopupOnSelection}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ autoPopupOnSelection: checked })
              }
            />
          </div>

          <Separator />

          {/* Trigger Modifier */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                触发修饰键
              </Label>
              <p className="text-[11px] text-muted-foreground">
                配合鼠标划选生效的键盘按键，可有效防止误触
              </p>
            </div>
            <div className="w-52">
              <Select
                value={general.triggerModifier}
                onChange={(val) =>
                  onUpdateGeneral({
                    triggerModifier: val as GeneralConfig["triggerModifier"],
                  })
                }
                options={[
                  { value: "None", label: "无 (鼠标划选直接触发)" },
                  { value: "Ctrl", label: "按住 Ctrl 划选" },
                  { value: "Alt", label: "按住 Alt 划选" },
                  { value: "Shift", label: "按住 Shift 划选" },
                ]}
              />
            </div>
          </div>

          <Separator />

          {/* Min Selection Length */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                最小选词字符长度
              </Label>
              <p className="text-[11px] text-muted-foreground">
                低于此字符数的选中文本将自动忽略，不弹出气泡
              </p>
            </div>
            <div className="w-52">
              <Input
                type="number"
                min={1}
                max={100}
                value={general.minSelectionLength}
                onChange={(e) =>
                  onUpdateGeneral({
                    minSelectionLength: parseInt(e.target.value) || 1,
                  })
                }
                className="w-full text-right font-mono"
              />
            </div>
          </div>

          <Separator />

          {/* Global Hotkey */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                全局唤醒快捷键
              </Label>
              <p className="text-[11px] text-muted-foreground">
                随时通过键盘组合键获取当前选中文本并调起助手
              </p>
            </div>
            <div className="w-52">
              <Input
                type="text"
                value={general.globalHotkey}
                placeholder="例如: Alt+Space"
                onChange={(e) =>
                  onUpdateGeneral({ globalHotkey: e.target.value })
                }
                className="w-full font-mono text-xs"
              />
            </div>
          </div>



          <Separator />

          {/* Theme */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                外观主题
              </Label>
              <p className="text-[11px] text-muted-foreground">
                选择 IOX 界面色彩风格模式
              </p>
            </div>
            <div className="w-52">
              <Select
                value={general.theme}
                onChange={(val) =>
                  onUpdateGeneral({
                    theme: val as GeneralConfig["theme"],
                  })
                }
                options={[
                  { value: "system", label: "跟随系统 (System)", icon: Monitor },
                  { value: "dark", label: "深色模式 (Dark)", icon: Moon },
                  { value: "light", label: "浅色模式 (Light)", icon: Sun },
                ]}
              />
            </div>
          </div>

          <Separator />

          {/* Overlay Opacity */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground font-medium">
                  界面背景透明度
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  调节设置页面、划词胶囊条与悬浮卡片的毛玻璃背景透光度
                </p>
              </div>
              <div className="w-52 flex items-center gap-3">
                <Slider
                  min={50}
                  max={100}
                  step={1}
                  value={general.overlayOpacity ?? 90}
                  onChange={(val) => onUpdateGeneral({ overlayOpacity: val })}
                  className="flex-1"
                />
                <span className="w-9 text-right text-xs font-mono text-muted-foreground font-semibold">
                  {general.overlayOpacity ?? 90}%
                </span>
              </div>
            </div>

            {/* 实时微缩毛玻璃对比展台 */}
            <div className="relative rounded-xl p-3 overflow-hidden border border-border/50 bg-gradient-to-r from-blue-500/15 via-indigo-500/15 to-purple-500/15 dark:from-blue-600/20 dark:via-indigo-600/20 dark:to-purple-600/20 select-none">
              <div className="relative z-10 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-medium text-muted-foreground">
                    效果实时预览 (当前不透明度 {general.overlayOpacity ?? 90}%)
                  </span>
                  <span className="text-[10px] text-muted-foreground/80">
                    毛玻璃高斯模糊已联动
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                  {/* 1. 微缩胶囊气泡 */}
                  <div className="capsule-glass h-7 px-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1.5 shadow-sm">
                    <IOXLogo size={16} />
                    <span className="text-[11px] font-medium text-foreground">气泡透明度</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                      <Sparkles size={10} />
                      <span>AI动作</span>
                    </span>
                  </div>

                  {/* 2. 微缩卡片透光效果 */}
                  <div className="flex-1 min-w-[180px] bg-[var(--bg-overlay-card)] backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-lg px-2.5 py-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-[10.5px] text-muted-foreground border-b border-border/40 pb-1 mb-1">
                      <span className="font-medium text-foreground">AI 结果卡片</span>
                      <span>Markdown 预览</span>
                    </div>
                    <p className="text-[10.5px] text-foreground/90 line-clamp-1">
                      透明度调节实时生效，背景磨砂透光清晰自然。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* API Card Size & Reset */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                API 流式卡片尺寸与重置
              </Label>
              <p className="text-[11px] text-muted-foreground">
                展开流式卡片时的默认宽高，拖拽卡片右下角可自由缩放并自动记忆
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

          {/* Floating Ball Controls */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                桌面常驻悬浮球
              </Label>
              <p className="text-[11px] text-muted-foreground">
                在屏幕边缘常驻圆形快捷球，支持随时拖拽、单击提问与双击打开设置
              </p>
            </div>
            <Switch
              checked={general.enableFloatingBall ?? true}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ enableFloatingBall: checked })
              }
            />
          </div>

          {(general.enableFloatingBall ?? true) && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs text-foreground font-medium">
                    悬浮球贴边自动半隐藏
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    悬浮球吸附在屏幕边缘闲置 2.5 秒后自动向边缘缩进 50% 并半透明化
                  </p>
                </div>
                <Switch
                  checked={general.floatingBallAutoHide ?? true}
                  onCheckedChange={(checked) =>
                    onUpdateGeneral({ floatingBallAutoHide: checked })
                  }
                />
              </div>
            </>
          )}

          <Separator />

          {/* Auto Start */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                开机自启动
              </Label>
              <p className="text-[11px] text-muted-foreground">
                登录 Windows 系统后自动在后台托盘运行 IOX
              </p>
            </div>
            <Switch
              checked={general.autoStart || false}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ autoStart: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
