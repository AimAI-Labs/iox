import React from "react";
import { Monitor, Moon, Sun, LayoutGrid, Layers } from "lucide-react";
import { GeneralConfig, WebWindowMode } from "@/types/config";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { IOXLogo } from "@/components/common";
import { Sparkles } from "lucide-react";

interface GeneralTabProps {
  general: GeneralConfig;
  onUpdateGeneral: (updated: Partial<GeneralConfig>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  general,
  onUpdateGeneral,
}) => {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          划词触发与常规设置
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          调整系统级取词逻辑、快捷键、Web 官网浮窗模式与界面外观
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

          {/* Web Window Mode */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                Web 官网浮窗模式
              </Label>
              <p className="text-[11px] text-muted-foreground">
                选择点击 Web 官网动作时的窗口展现与复用机制
              </p>
            </div>
            <div className="w-52">
              <Select
                value={general.webWindowMode || "multi_window"}
                onChange={(val) =>
                  onUpdateGeneral({
                    webWindowMode: val as WebWindowMode,
                  })
                }
                options={[
                  {
                    value: "multi_window",
                    label: "独立多窗口 (推荐)",
                    icon: LayoutGrid,
                    description: "同动作单例复用，支持多 AI 桌面并排对比",
                  },
                  {
                    value: "tabbed",
                    label: "统一多标签 (Hub)",
                    icon: Layers,
                    description: "所有 Web 动作收拢在单一浮窗内集中管理",
                  },
                ]}
              />
            </div>
          </div>

          <Separator />

          {/* Auto Copy On Web Action */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-xs text-foreground font-medium">
                Web 动作自动复制文本
              </Label>
              <p className="text-[11px] text-muted-foreground">
                触发 Web 官网动作时，自动将划选内容写入剪贴板（便于在网页中快速粘贴）
              </p>
            </div>
            <Switch
              checked={general.autoCopyOnWebAction || false}
              onCheckedChange={(checked) =>
                onUpdateGeneral({ autoCopyOnWebAction: checked })
              }
            />
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
                  悬浮窗背景透明度
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  调节划词胶囊条与 AI 结果卡片的毛玻璃背景透光度
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
