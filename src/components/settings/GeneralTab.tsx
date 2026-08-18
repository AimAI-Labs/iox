import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { GeneralConfig } from "../../types/config";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";

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
          调整系统级取词逻辑、快捷键、触发灵敏度与界面外观
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
