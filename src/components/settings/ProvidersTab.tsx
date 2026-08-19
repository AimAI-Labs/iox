import React, { useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Box, RefreshCw, Check, AlertCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ProviderConfig } from "@/types/config";
import { DynamicIcon } from "@/components/Icons";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ProvidersTabProps {
  providers: ProviderConfig[];
  onAddProvider: () => void;
  onUpdateProvider: (id: string, updated: Partial<ProviderConfig>) => void;
  onRemoveProvider: (id: string) => void;
}

interface FetchStatus {
  loading: boolean;
  error?: string;
  successMsg?: string;
}

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  onAddProvider,
  onUpdateProvider,
  onRemoveProvider,
}) => {
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [fetchStatus, setFetchStatus] = useState<{ [id: string]: FetchStatus }>({});

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleFetchModels = async (p: ProviderConfig) => {
    const trimmedUrl = p.baseUrl.trim();
    if (!trimmedUrl) {
      setFetchStatus((prev) => ({
        ...prev,
        [p.id]: { loading: false, error: "请先填写 API Base URL" },
      }));
      return;
    }

    setFetchStatus((prev) => ({
      ...prev,
      [p.id]: { loading: true, error: undefined, successMsg: undefined },
    }));

    try {
      const models = await invoke<string[]>("fetch_provider_models", {
        baseUrl: trimmedUrl,
        apiKey: p.apiKey.trim(),
      });

      if (models && models.length > 0) {
        // 自动设置获取到的模型列表，并将默认调用模型设置为第 1 个
        onUpdateProvider(p.id, {
          models,
          defaultModel: models[0],
        });

        setFetchStatus((prev) => ({
          ...prev,
          [p.id]: {
            loading: false,
            successMsg: `成功获取 ${models.length} 个可用模型，已默认选择第 1 个`,
          },
        }));

        setTimeout(() => {
          setFetchStatus((prev) => {
            const current = prev[p.id];
            if (current?.successMsg) {
              return { ...prev, [p.id]: { loading: false } };
            }
            return prev;
          });
        }, 4000);
      } else {
        setFetchStatus((prev) => ({
          ...prev,
          [p.id]: { loading: false, error: "服务商未返回可用模型列表" },
        }));
      }
    } catch (err: unknown) {
      const errorMsg =
        typeof err === "string"
          ? err
          : err instanceof Error
          ? err.message
          : "获取模型列表失败";
      setFetchStatus((prev) => ({
        ...prev,
        [p.id]: { loading: false, error: errorMsg },
      }));
    }
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
            配置支持 OpenAI Compatible 协议的大语言模型 API 接口，支持自动获取模型列表
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
          const status = fetchStatus[p.id] || { loading: false };

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
                <div className="grid grid-cols-2 gap-3">
                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <Label>API Base URL</Label>
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
                    <div className="flex items-center justify-between">
                      <Label>API Key</Label>
                      <button
                        type="button"
                        onClick={() => toggleKeyVisibility(p.id)}
                        className="text-[10px] text-muted-foreground/80 hover:text-foreground flex items-center gap-0.5 outline-none"
                      >
                        {isKeyVisible ? (
                          <>
                            <EyeOff size={10} /> 隐藏
                          </>
                        ) : (
                          <>
                            <Eye size={10} /> 显示
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

                {/* Status Alert for Fetch Models */}
                {status.error && (
                  <div className="text-[11px] text-destructive flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 px-2.5 py-1.5 rounded-md">
                    <AlertCircle size={13} className="shrink-0" />
                    <span className="break-all">{status.error}</span>
                  </div>
                )}
                {status.successMsg && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-md">
                    <Check size={13} className="shrink-0" />
                    <span>{status.successMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Available Models */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>可用模型列表 ({p.models.length})</Label>
                      <button
                        type="button"
                        disabled={status.loading}
                        onClick={() => handleFetchModels(p)}
                        className="text-[11px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 outline-none disabled:opacity-50 transition-colors cursor-pointer"
                        title="从 API 自动拉取可用模型列表"
                      >
                        <RefreshCw
                          size={11}
                          className={status.loading ? "animate-spin" : ""}
                        />
                        <span>{status.loading ? "获取中..." : "获取模型"}</span>
                      </button>
                    </div>
                    <Input
                      type="text"
                      value={p.models.join(", ")}
                      placeholder="deepseek-chat, deepseek-coder"
                      onChange={(e) => {
                        const newModels = e.target.value
                          .split(",")
                          .map((m) => m.trim())
                          .filter(Boolean);
                        onUpdateProvider(p.id, {
                          models: newModels,
                          defaultModel:
                            newModels.includes(p.defaultModel) ||
                            newModels.length === 0
                              ? p.defaultModel
                              : newModels[0],
                        });
                      }}
                    />
                    {/* Model Badges preview */}
                    {p.models.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {p.models.map((m, mIdx) => (
                          <Badge
                            key={mIdx}
                            variant={
                              m === p.defaultModel ? "default" : "secondary"
                            }
                            className="text-[10px] px-1.5 py-0 h-4 font-mono font-normal cursor-pointer hover:border-primary/60 transition-colors"
                            onClick={() =>
                              onUpdateProvider(p.id, { defaultModel: m })
                            }
                            title="点击设为默认模型"
                          >
                            {m}
                            {m === p.defaultModel && " ★"}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Default Model */}
                  <div className="space-y-1.5">
                    <Label>默认调用模型</Label>
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
                        placeholder="例如: deepseek-chat"
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
