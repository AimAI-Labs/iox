import React, { useState } from "react";
import { Plus, X, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  const [newInput, setNewInput] = useState("");

  const handleAdd = () => {
    const trimmed = newInput.trim();
    if (!trimmed) return;
    onAddBlacklist(trimmed);
    setNewInput("");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="pb-1 border-b border-border/30">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          应用排除黑名单
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          在以下前台程序或游戏进程中划词时，IOX 悬浮气泡将自动静默，不干扰正常操作
        </p>
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardContent className="p-4 space-y-4">
          {/* Add input row */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="输入进程文件名，例如: League of Legends.exe 或 Code.exe"
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
              <span>添加</span>
            </Button>
          </div>

          {/* Badges container */}
          <div className="pt-1">
            {blacklist.length === 0 ? (
              <div className="py-6 flex flex-col items-center justify-center text-center text-muted-foreground/60 space-y-1.5 border border-dashed border-border/40 rounded-lg bg-muted/10">
                <ShieldCheck size={24} className="opacity-40" />
                <p className="text-xs">暂无排除黑名单进程</p>
                <p className="text-[10px] text-muted-foreground/50">
                  IOX 会在所有常规桌面软件中响应划词
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                  <span>已屏蔽进程 ({blacklist.length})</span>
                  <span className="text-[10px]">点击 × 即可取消屏蔽</span>
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
                        className="rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive text-muted-foreground/60 transition-colors outline-none"
                        title={`移除 ${item}`}
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
    </div>
  );
};
