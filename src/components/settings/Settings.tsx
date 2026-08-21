import React, { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { AppConfig, ProviderConfig, ActionConfig, GeneralConfig, ApiCardConfig } from "@/types/config";
import { useTheme, broadcastThemeChange } from "@/hooks/useTheme";
import { MacTitleBar } from "@/components/MacTitleBar";
import { SettingsSidebar, SettingsTab } from "@/components/settings/SettingsSidebar";
import { ProvidersTab } from "@/components/settings/ProvidersTab";
import { ActionsTab } from "@/components/settings/actions";
import { ApiCardTab } from "@/components/settings/ApiCardTab";
import { SessionsTab } from "@/components/settings/SessionsTab";
import { WebviewTab } from "@/components/settings/WebviewTab";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { BlacklistTab } from "@/components/settings/BlacklistTab";

export interface SettingsProps {
  config: AppConfig;
  onSave: (newConfig: AppConfig) => Promise<boolean>;
}

export const Settings: React.FC<SettingsProps> = ({ config, onSave }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [formData, setFormData] = useState<AppConfig>(config);
  const [saving, setSaving] = useState(false);
  const formDataRef = useRef<AppConfig>(formData);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // 监听来自其他窗口或快捷调起的 Tab 切换指令
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("open_settings_tab", (event) => {
      if (
        event.payload &&
        ["providers", "actions", "api_card", "sessions", "web", "general", "blacklist"].includes(event.payload)
      ) {
        setActiveTab(event.payload as SettingsTab);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 主题与透明度即时预览
  useTheme(formData.general.theme, formData.general.overlayOpacity);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await onSave(formDataRef.current);
      if (ok) {
        toast.success("配置已保存", {
          description: "所有修改已即时生效",
        });
      } else {
        toast.error("配置保存失败", {
          description: "请检查填写内容或系统日志",
        });
      }
    } catch (err) {
      toast.error("配置保存异常", {
        description: String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  // 支持 Ctrl + S / Cmd + S 快捷键快速保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saving]);

  // Provider 更新 (基于 ID)
  const updateProvider = (id: string, updated: Partial<ProviderConfig>) => {
    setFormData((prev) => ({
      ...prev,
      providers: prev.providers.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    }));
  };

  // 添加 Provider
  const addProvider = () => {
    const newP: ProviderConfig = {
      id: `custom_${Date.now()}`,
      name: "自定义服务商",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      models: ["gpt-4o-mini", "gpt-4o"],
      defaultModel: "gpt-4o-mini",
    };
    setFormData((prev) => ({
      ...prev,
      providers: [...prev.providers, newP],
    }));
  };

  // 删除 Provider (基于 ID)
  const removeProvider = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      providers: prev.providers.filter((p) => p.id !== id),
    }));
  };

  // Action 更新 (基于 ID)
  const updateAction = (id: string, updated: Partial<ActionConfig>) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => (a.id === id ? { ...a, ...updated } : a)),
    }));
  };

  // 添加 Action（支持直接传入预设模板）
  const addAction = (preset?: Partial<ActionConfig> & { defaultIdPrefix?: string }) => {
    const defaultProviderId = formData.providers[0]?.id || "deepseek";
    const baseId = preset?.defaultIdPrefix || "act_custom";
    // 检查是否存在重复 id，若存在则追加随机时间戳
    const isIdTaken = formData.actions.some((a) => a.id === baseId);
    const finalId = isIdTaken ? `${baseId}_${Date.now()}` : (preset?.defaultIdPrefix ? baseId : `act_${Date.now()}`);

    const newA: ActionConfig = {
      id: finalId,
      name: preset?.name || "新动作",
      icon: preset?.icon || "Sparkles",
      actionType: preset?.actionType || "api",
      providerId: preset?.actionType === "api" ? (preset?.providerId || defaultProviderId) : undefined,
      promptTemplate: preset?.promptTemplate || (preset?.actionType === "api" ? "请分析以下内容：\n\n{text}" : undefined),
      urlTemplate: preset?.urlTemplate || "",
      copyToClipboard: preset?.copyToClipboard ?? false,
      inputSelector: preset?.inputSelector,
      submitSelector: preset?.submitSelector,
      autoSubmit: preset?.autoSubmit,
      enabled: preset?.enabled ?? true,
    };
    setFormData((prev) => ({
      ...prev,
      actions: [...prev.actions, newA],
    }));
  };

  // 删除 Action (基于 ID)
  const removeAction = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions.filter((a) => a.id !== id),
    }));
  };

  // 动作重新排序
  const reorderActions = (newActions: ActionConfig[]) => {
    setFormData((prev) => ({
      ...prev,
      actions: newActions,
    }));
  };

  // 更新 General 配置
  const updateGeneral = (updated: Partial<GeneralConfig>) => {
    setFormData((prev) => {
      const next = {
        ...prev,
        general: {
          ...prev.general,
          ...updated,
        },
      };
      // 当修改了 theme 或 overlayOpacity 时，即时全局广播同步所有窗口
      if (updated.theme || updated.overlayOpacity !== undefined) {
        broadcastThemeChange(next.general.theme, next.general.overlayOpacity);
      }
      return next;
    });
  };

  // 更新 ApiCard 配置
  const updateApiCard = (updated: Partial<ApiCardConfig>) => {
    setFormData((prev) => ({
      ...prev,
      apiCard: {
        ...prev.apiCard,
        ...updated,
      },
    }));
  };

  // 添加黑名单
  const addBlacklist = (processName: string) => {
    const name = processName.trim();
    if (!name) return;
    setFormData((prev) => {
      if (prev.blacklist.includes(name)) return prev;
      return {
        ...prev,
        blacklist: [...prev.blacklist, name],
      };
    });
  };

  // 移除黑名单 (基于进程名)
  const removeBlacklist = (processName: string) => {
    setFormData((prev) => ({
      ...prev,
      blacklist: prev.blacklist.filter((item) => item !== processName),
    }));
  };

  return (
    <div className="w-screen h-screen bg-transparent flex items-center justify-center box-border overflow-hidden select-none">
      <div className="w-full h-full flex flex-col bg-[var(--bg-overlay-card)] text-foreground rounded-xl border border-black/10 dark:border-white/10 overflow-hidden backdrop-blur-2xl">
        {/* macOS 沉浸式标题栏 */}
        <MacTitleBar title="IOX 设置" />

        {/* 设置主体区 */}
        <div className="flex flex-1 h-[calc(100%-38px)] overflow-hidden">
          {/* 左侧侧边栏 */}
          <SettingsSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSave={handleSave}
          />

          {/* 右侧主工作区 */}
          <main className="flex-1 h-full overflow-hidden user-select-text bg-transparent flex flex-col">
            {activeTab === "providers" && (
              <div className="flex-1 overflow-y-auto p-5">
                <ProvidersTab
                  providers={formData.providers}
                  onAddProvider={addProvider}
                  onUpdateProvider={updateProvider}
                  onRemoveProvider={removeProvider}
                />
              </div>
            )}

            {activeTab === "actions" && (
              <div className="flex-1 h-full overflow-hidden p-5 flex flex-col">
                <ActionsTab
                  actions={formData.actions}
                  providers={formData.providers}
                  general={formData.general}
                  onUpdateGeneral={updateGeneral}
                  onAddAction={addAction}
                  onUpdateAction={updateAction}
                  onRemoveAction={removeAction}
                  onReorderActions={reorderActions}
                />
              </div>
            )}

            {activeTab === "api_card" && (
              <div className="flex-1 overflow-y-auto p-5">
                <ApiCardTab
                  apiCard={formData.apiCard}
                  actions={formData.actions}
                  general={formData.general}
                  onUpdateApiCard={updateApiCard}
                  onUpdateGeneral={updateGeneral}
                  onNavigateToActions={() => setActiveTab("actions")}
                />
              </div>
            )}

            {activeTab === "sessions" && (
              <div className="flex-1 h-full overflow-hidden p-5 flex flex-col">
                <SessionsTab />
              </div>
            )}

            {activeTab === "web" && (
              <div className="flex-1 overflow-y-auto p-5">
                <WebviewTab
                  general={formData.general}
                  actions={formData.actions}
                  onUpdateGeneral={updateGeneral}
                  onNavigateToActions={() => setActiveTab("actions")}
                />
              </div>
            )}

            {activeTab === "general" && (
              <div className="flex-1 overflow-y-auto p-5">
                <GeneralTab
                  general={formData.general}
                  onUpdateGeneral={updateGeneral}
                />
              </div>
            )}

            {activeTab === "blacklist" && (
              <div className="flex-1 overflow-y-auto p-5">
                <BlacklistTab
                  blacklist={formData.blacklist}
                  onAddBlacklist={addBlacklist}
                  onRemoveBlacklist={removeBlacklist}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
