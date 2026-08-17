import React, { useState } from 'react';
import { AppConfig, ProviderConfig, ActionConfig } from '../types/config';
import { DynamicIcon } from './Icons';
import { MacTitleBar } from './MacTitleBar';
import {
  Cpu,
  Zap,
  Sliders,
  Shield,
  Plus,
  Trash2,
  Save,
  Check,
} from 'lucide-react';

interface SettingsProps {
  config: AppConfig;
  onSave: (newConfig: AppConfig) => Promise<boolean>;
}

export const Settings: React.FC<SettingsProps> = ({ config, onSave }) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'actions' | 'general' | 'blacklist'>('providers');
  const [formData, setFormData] = useState<AppConfig>(config);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newBlacklistInput, setNewBlacklistInput] = useState('');

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(formData);
    setSaving(false);
    if (ok) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
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
      name: '自定义服务商',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      models: ['gpt-4o-mini', 'gpt-4o'],
      defaultModel: 'gpt-4o-mini',
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
      name: '新动作',
      icon: 'Sparkles',
      actionType: 'api',
      providerId: formData.providers[0]?.id || 'deepseek',
      promptTemplate: '请分析以下内容：\n\n{text}',
      urlTemplate: '',
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

  // 添加黑名单
  const addBlacklist = () => {
    if (!newBlacklistInput.trim()) return;
    setFormData({
      ...formData,
      blacklist: [...formData.blacklist, newBlacklistInput.trim()],
    });
    setNewBlacklistInput('');
  };

  // 移除黑名单
  const removeBlacklist = (index: number) => {
    setFormData({
      ...formData,
      blacklist: formData.blacklist.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="settings-page-wrapper">
      <div className="settings-page">
        <MacTitleBar title="IOX 设置" />
        <div className="settings-body">
          {/* 侧边导航栏 */}
          <div className="settings-sidebar">
        <div className="settings-brand">
          <div className="brand-logo">IOX</div>
          <span className="brand-subtitle">划词 AI 助手</span>
        </div>

        <nav className="settings-nav">
          <button
            className={`nav-item ${activeTab === 'providers' ? 'active' : ''}`}
            onClick={() => setActiveTab('providers')}
          >
            <Cpu size={16} />
            <span>模型服务商</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            <Zap size={16} />
            <span>动作管理</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Sliders size={16} />
            <span>划词与通用</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'blacklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('blacklist')}
          >
            <Shield size={16} />
            <span>应用黑名单</span>
          </button>
        </nav>

        <div className="settings-sidebar-footer">
          <button
            className={`btn-save ${savedSuccess ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>已保存</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>{saving ? '保存中...' : '保存配置'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 主配置内容区 */}
      <div className="settings-content">
        {/* Tab 1: 服务商配置 */}
        {activeTab === 'providers' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h2>模型服务商管理 (OpenAI Compatible)</h2>
              <button className="btn-secondary" onClick={addProvider}>
                <Plus size={14} /> 添加服务商
              </button>
            </div>

            <div className="card-list">
              {formData.providers.map((p, idx) => (
                <div key={p.id} className="config-card">
                  <div className="config-card-header">
                    <input
                      type="text"
                      className="input-card-title"
                      value={p.name}
                      onChange={(e) => updateProvider(idx, { name: e.target.value })}
                    />
                    <button
                      className="btn-danger-icon"
                      onClick={() => removeProvider(idx)}
                      title="删除此服务商"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>API Base URL</label>
                      <input
                        type="text"
                        value={p.baseUrl}
                        placeholder="https://api.deepseek.com/v1"
                        onChange={(e) => updateProvider(idx, { baseUrl: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>API Key</label>
                      <input
                        type="password"
                        value={p.apiKey}
                        placeholder="sk-xxxxxxxxxxxxxxxx"
                        onChange={(e) => updateProvider(idx, { apiKey: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label>可用模型列表 (英文逗号分隔)</label>
                      <input
                        type="text"
                        value={p.models.join(', ')}
                        onChange={(e) =>
                          updateProvider(idx, {
                            models: e.target.value
                              .split(',')
                              .map((m) => m.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label>默认调用模型</label>
                      <input
                        type="text"
                        value={p.defaultModel}
                        onChange={(e) => updateProvider(idx, { defaultModel: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: 动作管理 */}
        {activeTab === 'actions' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h2>动作列表与 Prompt 模板</h2>
              <button className="btn-secondary" onClick={addAction}>
                <Plus size={14} /> 新建动作
              </button>
            </div>

            <div className="card-list">
              {formData.actions.map((act, idx) => (
                <div key={act.id} className="config-card">
                  <div className="config-card-header">
                    <div className="action-title-group">
                      <DynamicIcon name={act.icon} size={18} />
                      <input
                        type="text"
                        className="input-card-title"
                        value={act.name}
                        onChange={(e) => updateAction(idx, { name: e.target.value })}
                      />
                    </div>

                    <div className="action-header-controls">
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={act.enabled}
                          onChange={(e) => updateAction(idx, { enabled: e.target.checked })}
                        />
                        <span>启用</span>
                      </label>
                      <button
                        className="btn-danger-icon"
                        onClick={() => removeAction(idx)}
                        title="删除动作"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>动作类型</label>
                      <select
                        value={act.actionType}
                        onChange={(e) =>
                          updateAction(idx, { actionType: e.target.value as 'api' | 'web' })
                        }
                      >
                        <option value="api">API 流式卡片</option>
                        <option value="web">Web 官网直达</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Lucide 图标名</label>
                      <input
                        type="text"
                        value={act.icon}
                        onChange={(e) => updateAction(idx, { icon: e.target.value })}
                      />
                    </div>

                    {act.actionType === 'api' ? (
                      <>
                        <div className="form-group">
                          <label>绑定服务商</label>
                          <select
                            value={act.providerId || ''}
                            onChange={(e) => updateAction(idx, { providerId: e.target.value })}
                          >
                            {formData.providers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group full-width">
                          <label>Prompt 提示词模板 (使用 {"{text}"} 代表划选内容)</label>
                          <textarea
                            rows={3}
                            value={act.promptTemplate || ''}
                            onChange={(e) =>
                              updateAction(idx, { promptTemplate: e.target.value })
                            }
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-group full-width">
                          <label>URL 跳转模板 (支持 {"{text}"})</label>
                          <input
                            type="text"
                            value={act.urlTemplate || ''}
                            placeholder="https://tongyi.aliyun.com/qianwen/?q={text}"
                            onChange={(e) => updateAction(idx, { urlTemplate: e.target.value })}
                          />
                        </div>

                        <div className="form-group full-width">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={act.copyToClipboard || false}
                              onChange={(e) =>
                                updateAction(idx, { copyToClipboard: e.target.checked })
                              }
                            />
                            <span>打开网页前自动将划选文本写入剪贴板（适用于不支持 URL 参数的官网如 DeepSeek）</span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: 通用与划词设置 */}
        {activeTab === 'general' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h2>划词触发与常规设置</h2>
            </div>

            <div className="config-card">
              <div className="form-grid single-col">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.general.autoPopupOnSelection}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          general: {
                            ...formData.general,
                            autoPopupOnSelection: e.target.checked,
                          },
                        })
                      }
                    />
                    <span>鼠标划选文本后自动弹出气泡菜单</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>触发修饰键</label>
                  <select
                    value={formData.general.triggerModifier}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        general: {
                          ...formData.general,
                          triggerModifier: e.target.value as any,
                        },
                      })
                    }
                  >
                    <option value="None">无 (鼠标划选直接触发)</option>
                    <option value="Ctrl">按住 Ctrl 划选</option>
                    <option value="Alt">按住 Alt 划选</option>
                    <option value="Shift">按住 Shift 划选</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>最小选词字符长度</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.general.minSelectionLength}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        general: {
                          ...formData.general,
                          minSelectionLength: parseInt(e.target.value) || 1,
                        },
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label>全局唤醒快捷键</label>
                  <input
                    type="text"
                    value={formData.general.globalHotkey}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        general: {
                          ...formData.general,
                          globalHotkey: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: 黑名单 */}
        {activeTab === 'blacklist' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h2>应用排除黑名单 (进程文件名)</h2>
            </div>

            <div className="config-card">
              <p className="hint-text">
                在以下应用中划词时，悬浮气泡将自动静默，不干扰正常操作：
              </p>

              <div className="blacklist-input-row">
                <input
                  type="text"
                  placeholder="例如: League of Legends.exe"
                  value={newBlacklistInput}
                  onChange={(e) => setNewBlacklistInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBlacklist()}
                />
                <button className="btn-secondary" onClick={addBlacklist}>
                  <Plus size={14} /> 添加
                </button>
              </div>

              <div className="blacklist-tags">
                {formData.blacklist.map((item, idx) => (
                  <div key={idx} className="tag-item">
                    <span>{item}</span>
                    <button onClick={() => removeBlacklist(idx)} title="移除">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
</div>
);
};
