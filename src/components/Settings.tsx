import React, { useState } from "react";
import { AppConfig, ProviderConfig, ActionConfig, GeneralConfig } from "../types/config";
import { MacTitleBar } from "./MacTitleBar";
import { SettingsSidebar, SettingsTab } from "./settings/SettingsSidebar";
import { ProvidersTab } from "./settings/ProvidersTab";
import { ActionsTab } from "./settings/ActionsTab";
import { GeneralTab } from "./settings/GeneralTab";
import { BlacklistTab } from "./settings/BlacklistTab";

interface SettingsProps {
  config: AppConfig;
  onSave: (newConfig: AppConfig) => Promise<boolean>;
}

export const Settings: React.FC<SettingsProps> = ({ config, onSave }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("providers");
  const [formData, setFormData] = useState<AppConfig>(config);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(formData);
    setSaving(false);
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2200);
    }
  };

  // Provider 更新
  const updateProvider = (index: number, updated: Partial<ProviderConfig>) => {
    const list = [...formData.providers];
    list[index] = { ...list[index], ...updated };
    setFormData({ ...formData, providers: list });
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
    setFormData({ ...formData, providers: [...formData.providers, newP] });
  };

  // 删除 Provider
  const removeProvider = (index: number) => {
    const list = formData.providers.filter((_, i) => i !== index);
    setFormData({ ...formData, providers: list });
  };

  // Action 更新
  const updateAction = (index: number, updated: Partial<ActionConfig>) => {
    const list = [...formData.actions];
    list[index] = { ...list[index], ...updated };
    setFormData({ ...formData, actions: list });
  };

  // 添加 Action
  const addAction = () => {
    const newA: ActionConfig = {
      id: `act_${Date.now()}`,
      name: "新动作",
      icon: "Sparkles",
      actionType: "api",
      providerId: formData.providers[0]?.id || "deepseek",
      promptTemplate: "请分析以下内容：\n\n{text}",
      urlTemplate: "",
      copyToClipboard: false,
      enabled: true,
    };
    setFormData({ ...formData, actions: [...formData.actions, newA] });
  };

  // 删除 Action
  const removeAction = (index: number) => {
    const list = formData.actions.filter((_, i) => i !== index);
    setFormData({ ...formData, actions: list });
  };

  // 更新 General 配置
  const updateGeneral = (updated: Partial<GeneralConfig>) => {
    setFormData({
      ...formData,
      general: {
        ...formData.general,
        ...updated,
      },
    });
  };

  // 添加黑名单
  const addBlacklist = (processName: string) => {
    if (!processName.trim()) return;
    if (formData.blacklist.includes(processName.trim())) return;
    setFormData({
      ...formData,
      blacklist: [...formData.blacklist, processName.trim()],
    });
  };

  // 移除黑名单
  const removeBlacklist = (index: number) => {
    setFormData({
      ...formData,
      blacklist: formData.blacklist.filter((_, i) => i !== index),
    });
  };

  // 主题即时预览
  React.useEffect(() => {
    const root = document.documentElement;
    const theme = formData.general.theme || "system";
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      const isDark =
        theme === "dark" ||
        (theme === "system" && mediaQuery.matches);

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    applyTheme();

    if (theme === "system") {
      mediaQuery.addEventListener("change", applyTheme);
      return () => {
        mediaQuery.removeEventListener("change", applyTheme);
      };
    }
  }, [formData.general.theme]);

  return (
    <div className="w-screen h-screen p-0.5 bg-transparent flex items-center justify-center box-border overflow-hidden select-none">
      <div className="w-full h-full flex flex-col bg-white/85 dark:bg-zinc-950/85 text-foreground rounded-xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden backdrop-blur-2xl">
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

          {/* 右侧主工作区 (与侧边栏共享完全相同的统一页面背景) */}
          <main className="flex-1 p-5 overflow-y-auto user-select-text bg-transparent">
            {activeTab === "providers" && (
              <ProvidersTab
                providers={formData.providers}
                onAddProvider={addProvider}
                onUpdateProvider={updateProvider}
                onRemoveProvider={removeProvider}
              />
            )}

            {activeTab === "actions" && (
              <ActionsTab
                actions={formData.actions}
                providers={formData.providers}
                onAddAction={addAction}
                onUpdateAction={updateAction}
                onRemoveAction={removeAction}
              />
            )}

            {activeTab === "general" && (
              <GeneralTab
                general={formData.general}
                onUpdateGeneral={updateGeneral}
              />
            )}

            {activeTab === "blacklist" && (
              <BlacklistTab
                blacklist={formData.blacklist}
                onAddBlacklist={addBlacklist}
                onRemoveBlacklist={removeBlacklist}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
