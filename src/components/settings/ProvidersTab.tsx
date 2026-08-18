import React, { useState } from "react";
import { Plus, Trash2, Eye, EyeOff, Box } from "lucide-react";
import { ProviderConfig } from "@/types/config";
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

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  onAddProvider,
  onUpdateProvider,
  onRemoveProvider,
}) => {
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});

  const toggleKeyVisibility = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
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
            配置支持 OpenAI Compatible 协议的大语言模型 API 接口
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
          return (
            <Card
              key={p.id}
              className="group border-border/60 bg-card/60 hover:border-border/90 transition-all"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-2.5 px-3.5 border-b border-border/40 bg-muted/20">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
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

                <div className="grid grid-cols-2 gap-3">
                  {/* Available Models */}
                  <div className="space-y-1.5">
                    <Label>可用模型列表 (英文逗号分隔)</Label>
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
                            newModels.includes(p.defaultModel) || newModels.length === 0
                              ? p.defaultModel
                              : newModels[0],
                        });
                      }}
                    />
                    {/* Model Badges preview */}
                    {p.models.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {p.models.map((m, mIdx) => (
                          <Badge
                            key={mIdx}
                            variant={
                              m === p.defaultModel ? "default" : "secondary"
                            }
                            className="text-[10px] px-1.5 py-0 h-4 font-mono font-normal"
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
                          onUpdateProvider(p.id, { defaultModel: e.target.value })
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
