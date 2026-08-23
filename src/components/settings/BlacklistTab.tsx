import React, { useState } from "react";
import {
  Plus,
  X,
  ShieldAlert,
  ShieldCheck,
  Crosshair,
  Loader2,
  Check,
  AlertTriangle,
  AppWindow,
  Cpu,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardContent, Button, Input, Badge } from "@/components/ui";
import { PickedProcessInfo } from "@/types/config";
import { useTranslation } from "@/hooks/useTranslation";

interface BlacklistTabProps {
  blacklist: string[];
  onAddBlacklist: (processName: string) => void;
  onRemoveBlacklist: (processName: string) => void;
}

export const BlacklistTab: React.FC<BlacklistTabProps> = ({
  blacklist,
  onAddBlacklist,
  onRemoveBlacklist,
}) => {
  const { t, resolvedLanguage } = useTranslation();
  const isZh = resolvedLanguage === 'zh';

  const [newInput, setNewInput] = useState("");
  const [isPicking, setIsPicking] = useState(false);
  const [pickedInfo, setPickedInfo] = useState<PickedProcessInfo | null>(null);

  const handleAdd = () => {
    const trimmed = newInput.trim();
    if (!trimmed) return;
    onAddBlacklist(trimmed);
    setNewInput("");
  };

  const handleStartPick = async () => {
    try {
      setIsPicking(true);
      const result = await invoke<PickedProcessInfo | null>("start_window_picker");
      setIsPicking(false);
      if (result) {
        setPickedInfo(result);
      }
    } catch (err) {
      console.error("Window picker failed:", err);
      setIsPicking(false);
    }
  };

  const handleCancelPick = async () => {
    try {
      await invoke("cancel_window_picker");
      setIsPicking(false);
    } catch (err) {
      console.error("Cancel window picker failed:", err);
      setIsPicking(false);
    }
  };

  const isPickedAlreadyBlacklisted =
    pickedInfo !== null &&
    blacklist.some(
      (b) => b.toLowerCase() === pickedInfo.processName.toLowerCase()
    );

  const handleConfirmPicked = () => {
    if (!pickedInfo) return;
    if (!isPickedAlreadyBlacklisted) {
      onAddBlacklist(pickedInfo.processName);
    }
    setPickedInfo(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {isZh ? "应用排除黑名单" : "Process Blacklist"}
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isZh
            ? "在以下前台程序或游戏进程中划词时，IOX 悬浮气泡将自动静默，不干扰正常操作"
            : "IOX selection bubble stays silent in listed applications and games to avoid interference"}
        </p>
      </div>

      {/* Picking Active Banner */}
      {isPicking && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs text-foreground shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75" />
              <Crosshair size={16} className="text-primary shrink-0 relative" />
            </div>
            <div>
              <p className="font-medium text-primary">
                {isZh ? "🎯 正在瞄准拾取窗口..." : "🎯 Targeting window..."}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isZh ? (
                  <>
                    请在屏幕上点击目标软件窗口。按{" "}
                    <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 text-[10px] font-mono">
                      Esc
                    </kbd>{" "}
                    或鼠标右键可随时取消。
                  </>
                ) : (
                  <>
                    Click target window on screen. Press{" "}
                    <kbd className="px-1 py-0.5 rounded bg-muted/60 border border-border/50 text-[10px] font-mono">
                      Esc
                    </kbd>{" "}
                    or right click to cancel.
                  </>
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancelPick}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {t('common.cancel')}
          </Button>
        </div>
      )}

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          {/* Add input row */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder={isZh ? "输入进程文件名，例如: League of Legends.exe 或 Code.exe" : "Enter process executable name, e.g. Code.exe"}
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              className="flex-1 font-mono text-xs"
            />
            <Button
              onClick={handleAdd}
              size="sm"
              variant="default"
              className="gap-1 px-3"
            >
              <Plus size={13} />
              <span>{t('common.add')}</span>
            </Button>
            {isPicking ? (
              <Button
                onClick={handleCancelPick}
                size="sm"
                variant="destructive"
                className="gap-1.5 px-3 animate-pulse"
              >
                <Loader2 size={13} className="animate-spin" />
                <span>{isZh ? "取消拾取" : "Cancel Pick"}</span>
              </Button>
            ) : (
              <Button
                onClick={handleStartPick}
                size="sm"
                variant="outline"
                className="gap-1.5 px-3 border-border/70 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all"
                title={isZh ? "通过鼠标点击屏幕上的任意目标窗口自动识别并添加" : "Click any window on screen to detect and add"}
              >
                <Crosshair size={13} className="text-primary" />
                <span>{isZh ? "拾取窗口" : "Pick Window"}</span>
              </Button>
            )}
          </div>

          {/* Badges container */}
          <div className="pt-1">
            {blacklist.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center text-muted-foreground/60 space-y-1.5 border border-dashed border-border/40 rounded-lg bg-muted/10">
                <ShieldCheck size={24} className="opacity-40" />
                <p className="text-xs">{isZh ? "暂无排除黑名单进程" : "No blacklisted processes"}</p>
                <p className="text-[10px] text-muted-foreground/50">
                  {isZh ? "IOX 会在所有常规桌面软件中响应划词" : "IOX will respond in all standard applications"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                  <span>{isZh ? `已屏蔽进程 (${blacklist.length})` : `Excluded Processes (${blacklist.length})`}</span>
                  <span className="text-[10px]">{isZh ? "点击 × 即可取消屏蔽" : "Click × to remove"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-muted/20 border border-border/30 max-h-56 overflow-y-auto">
                  {blacklist.map((item) => (
                    <Badge
                      key={item}
                      variant="secondary"
                      className="group/badge pl-2.5 pr-1.5 py-1 text-xs font-mono bg-background/80 hover:bg-background border-border/60 flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <ShieldAlert size={11} className="text-amber-500/80" />
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveBlacklist(item)}
                        className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive text-muted-foreground/60 transition-colors outline-none cursor-pointer"
                        title={t('common.delete')}
                      >
                        <X size={11} />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Glassmorphic Picked Confirmation Modal */}
      {pickedInfo && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl p-5 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Crosshair size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {isZh ? "识别到目标窗口" : "Target Window Identified"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {isZh ? "是否将该软件进程加入排除黑名单？" : "Add this process to exclusion blacklist?"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickedInfo(null)}
                className="rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Target Process Info Details */}
            <div className="space-y-2.5 p-3 rounded-lg bg-muted/20 border border-border/40">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-medium text-muted-foreground flex items-center gap-1">
                  <AppWindow size={11} />
                  {isZh ? "窗口标题" : "Window Title"}
                </span>
                <p className="text-xs font-medium text-foreground line-clamp-2 select-text">
                  {pickedInfo.windowTitle || (isZh ? "未知窗口标题" : "Unknown Window Title")}
                </p>
              </div>

              <div className="space-y-1 pt-1 border-t border-border/30">
                <span className="text-[10px] uppercase font-medium text-muted-foreground flex items-center gap-1">
                  <Cpu size={11} />
                  {isZh ? "进程可执行文件" : "Process Executable"}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs px-2 py-0.5 bg-background/80 text-primary border-primary/30"
                  >
                    {pickedInfo.processName}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Status Tip */}
            {isPickedAlreadyBlacklisted ? (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{isZh ? "该进程已在黑名单列表中，无需重复添加" : "Process already in blacklist"}</span>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground px-0.5">
                {isZh
                  ? "添加后，在以此进程运行的所有窗口中划词时，IOX 将自动静默并不弹出气泡。"
                  : "After adding, IOX will stay silent in windows belonging to this process."}
              </p>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickedInfo(null)}
                className="h-8 px-3 text-xs"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleConfirmPicked}
                disabled={isPickedAlreadyBlacklisted}
                className="h-8 px-3 text-xs gap-1.5 shadow-sm"
              >
                <Check size={13} />
                <span>{isZh ? "确认添加至黑名单" : "Confirm Add"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
