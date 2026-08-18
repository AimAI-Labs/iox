import React, { useState } from "react";
import { AppConfig, ProviderConfig, ActionConfig, GeneralConfig } from "@/types/config";
import { useTheme } from "@/hooks/useTheme";
import { MacTitleBar } from "@/components/MacTitleBar";
import { SettingsSidebar, SettingsTab } from "@/components/settings/SettingsSidebar";
import { ProvidersTab } from "@/components/settings/ProvidersTab";
import { ActionsTab } from "@/components/settings/ActionsTab";
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
  const [savedSuccess, setSavedSuccess] = useState(false);

  // 主题即时预览
  useTheme(formData.general.theme);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(formData);
    setSaving(false);
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2200);
    }
  };

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

  // 添加 Action
  const addAction = () => {
    const defaultProviderId = formData.providers[0]?.id || "deepseek";
    const newA: ActionConfig = {
      id: `act_${Date.now()}`,
      name: "新动作",
      icon: "Sparkles",
      actionType: "api",
      providerId: defaultProviderId,
      promptTemplate: "请分析以下内容：\n\n{text}",
      urlTemplate: "",
      copyToClipboard: false,
      enabled: true,
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

  // 更新 General 配置
  const updateGeneral = (updated: Partial<GeneralConfig>) => {
    setFormData((prev) => ({
      ...prev,
      general: {
        ...prev.general,
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
      <div className="w-full h-full flex flex-col bg-white/85 dark:bg-zinc-950/85 text-foreground rounded-xl border border-black/10 dark:border-white/10 overflow-hidden backdrop-blur-2xl">
        {/* macOS 沉浸式标题栏 */}
        <MacTitleBar title="IOX 设置" />

        {/* 设置主体区 */}
        <div className="flex flex-1 h-[calc(100%-38px)] overflow-hidden">
          {/* 左侧侧边栏 */}
          <SettingsSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onSave={handleSave}
            saving={saving}
            savedSuccess={savedSuccess}
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
                  onAddAction={addAction}
                  onUpdateAction={updateAction}
                  onRemoveAction={removeAction}
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
