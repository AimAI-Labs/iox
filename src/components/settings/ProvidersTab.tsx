import React, { useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Box, RefreshCw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { ProviderConfig } from "@/types/config";
import { DynamicIcon } from "@/components/Icons";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";

interface ProvidersTabProps {
  providers: ProviderConfig[];
  onAddProvider: () => void;
  onUpdateProvider: (id: string, updated: Partial<ProviderConfig>) => void;
  onRemoveProvider: (id: string) => void;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  onAddProvider,
  onUpdateProvider,
  onRemoveProvider,
}) => {
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [fetchingIds, setFetchingIds] = useState<{ [key: string]: boolean }>({});
  // 缓存各服务商拉取或已知的候选模型列表池 (id -> models[])
  const [modelCandidates, setModelCandidates] = useState<{ [id: string]: string[] }>({});

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFetchModels = async (p: ProviderConfig) => {
    const trimmedUrl = p.baseUrl.trim();
    if (!trimmedUrl) {
      toast.error("请先填写 API Base URL", {
        description: `服务商 [${p.name || p.id}] 未配置有效 Base URL`,
      });
      return;
    }

    setFetchingIds((prev) => ({ ...prev, [p.id]: true }));
    const toastId = toast.loading(`正在从 ${p.name || "服务商"} 获取可用模型...`);

    try {
      const models = await invoke<string[]>("fetch_provider_models", {
        baseUrl: trimmedUrl,
        apiKey: p.apiKey.trim(),
      });

      if (models && models.length > 0) {
        // 更新候选模型池
        setModelCandidates((prev) => ({ ...prev, [p.id]: models }));

        // 默认勾选获取到的全部模型，并将默认调用模型设为第 1 个
        onUpdateProvider(p.id, {
          models,
          defaultModel: models[0],
        });

        toast.success(`成功获取 ${models.length} 个可用模型`, {
          id: toastId,
          description: `已默认选择第 1 个模型: ${models[0]}`,
        });
      } else {
        toast.error("服务商返回的模型列表为空", {
          id: toastId,
          description: "接口未返回任何可用模型，请检查服务商配置",
        });
      }
    } catch (err: unknown) {
      const errorMsg =
        typeof err === "string"
          ? err
          : err instanceof Error
          ? err.message
          : "获取模型列表失败";

      toast.error("获取模型列表失败", {
        id: toastId,
        description: errorMsg,
      });
    } finally {
      setFetchingIds((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  const handleModelsChange = (p: ProviderConfig, newModels: string[]) => {
    // 若原默认模型不在新选列表内，自动修正默认模型为新选列表的首项
    let newDefault = p.defaultModel;
    if (!newModels.includes(newDefault)) {
      newDefault = newModels.length > 0 ? newModels[0] : "";
    }

    onUpdateProvider(p.id, {
      models: newModels,
      defaultModel: newDefault,
    });
  };

  return (
    <div className="space-y-4">
      {/* Tab Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border/30">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            模型服务商管理
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            配置支持 OpenAI Compatible 协议的大语言模型 API 接口，支持下拉复选与自动获取模型
          </p>
        </div>
        <Button
          onClick={onAddProvider}
          size="sm"
          variant="outline"
          className="gap-1 text-xs border-border/80 hover:border-primary/50"
        >
          <Plus size={13} />
          <span>添加服务商</span>
        </Button>
      </div>

      {/* Provider Card List */}
      <div className="space-y-3">
        {providers.map((p) => {
          const isKeyVisible = showKeys[p.id] || false;
          const isFetching = fetchingIds[p.id] || false;

          // 合并当前已选项与已获取候选模型，去重生成选项
          const candidateList = Array.from(
            new Set([...(modelCandidates[p.id] || []), ...p.models])
          );

          return (
            <Card
              key={p.id}
              className="group border-border/60 bg-card/60 hover:border-border/90 transition-all"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2.5 px-3.5 border-b border-border/40 bg-muted/20">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-5 h-5 rounded bg-muted/60">
                    <DynamicIcon name={p.id || p.name} size={14} />
                  </div>
                  <Input
                    type="text"
                    value={p.name}
                    onChange={(e) =>
                      onUpdateProvider(p.id, { name: e.target.value })
                    }
                    className="h-6 w-44 font-semibold text-xs bg-transparent border-transparent hover:border-border/60 focus-visible:bg-background/80 px-1.5"
                    placeholder="服务商名称"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveProvider(p.id)}
                  className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                  title="删除此服务商"
                >
                  <Trash2 size={12} />
                </Button>
              </CardHeader>

              <CardContent className="p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-3 items-start">
                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5">
                      <Label>API Base URL</Label>
                    </div>
                    <Input
                      type="text"
                      value={p.baseUrl}
                      placeholder="https://api.deepseek.com/v1"
                      onChange={(e) =>
                        onUpdateProvider(p.id, { baseUrl: e.target.value })
                      }
                    />
                  </div>

                  {/* API Key */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5">
                      <Label>API Key</Label>
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(p.id)}
                        className="text-[10px] text-muted-foreground/80 hover:text-foreground flex items-center gap-0.5 outline-none cursor-pointer"
                      >
                        {isKeyVisible ? (
                          <>
                            <EyeOff size={11} /> 隐藏
                          </>
                        ) : (
                          <>
                            <Eye size={11} /> 显示
                          </>
                        )}
                      </button>
                    </div>
                    <Input
                      type={isKeyVisible ? "text" : "password"}
                      value={p.apiKey}
                      placeholder="sk-xxxxxxxxxxxxxxxx"
                      onChange={(e) =>
                        onUpdateProvider(p.id, { apiKey: e.target.value })
                      }
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-start">
                  {/* Available Models (MultiSelect Dropdown Checkboxes) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5">
                      <Label>可用模型列表 ({p.models.length})</Label>
                      <button
                        type="button"
                        disabled={isFetching}
                        onClick={() => handleFetchModels(p)}
                        className="text-[11px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 outline-none disabled:opacity-50 transition-colors cursor-pointer"
                        title="从 API 自动拉取可用模型列表"
                      >
                        <RefreshCw
                          size={11}
                          className={isFetching ? "animate-spin" : ""}
                        />
                        <span>{isFetching ? "获取中..." : "获取模型"}</span>
                      </button>
                    </div>

                    <MultiSelect
                      values={p.models}
                      options={candidateList.map((m) => ({
                        value: m,
                        label: m,
                      }))}
                      placeholder="点击下拉勾选可用模型..."
                      onChange={(newModels) => handleModelsChange(p, newModels)}
                      allowCustomInput={true}
                    />
                  </div>

                  {/* Default Model */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between h-5">
                      <Label>默认调用模型</Label>
                    </div>
                    {p.models.length > 0 ? (
                      <Select
                        value={p.defaultModel}
                        onChange={(val) =>
                          onUpdateProvider(p.id, { defaultModel: val })
                        }
                        options={p.models.map((m) => ({
                          value: m,
                          label: m,
                          icon: Box,
                        }))}
                      />
                    ) : (
                      <Input
                        type="text"
                        value={p.defaultModel}
                        placeholder="请先在左侧勾选或添加可用模型"
                        onChange={(e) =>
                          onUpdateProvider(p.id, {
                            defaultModel: e.target.value,
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
