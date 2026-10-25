import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { AppConfig, appConfigSchema } from '@/types/config';

/**
 * 校验 IPC 边界上的配置载荷。
 *
 * 校验失败说明前后端契约漂移：记录结构化错误，并按原始载荷继续运行，
 * 避免旧配置或新字段直接白屏；写入方向则由调用方拒绝提交。
 */
function readConfig(raw: unknown): { config: AppConfig; error: string | null } {
  const parsed = appConfigSchema.safeParse(raw);
  if (parsed.success) {
    return { config: parsed.data, error: null };
  }
  console.error('[config] 配置契约校验失败', parsed.error.issues);
  return { config: raw as AppConfig, error: parsed.error.message };
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const readVersion = useRef(0);

  const fetchConfig = useCallback(async () => {
    const version = ++readVersion.current;
    try {
      setLoading(true);
      const data = await invoke<unknown>('get_config');
      if (version !== readVersion.current) return;
      const result = readConfig(data);
      setConfig(result.config);
      setError(result.error);
    } catch (err) {
      if (version === readVersion.current) setError(String(err));
    } finally {
      if (version === readVersion.current) setLoading(false);
    }
  }, []);

  const updateConfig = async (newConfig: AppConfig): Promise<boolean> => {
    const parsed = appConfigSchema.safeParse(newConfig);
    if (!parsed.success) {
      console.error('[config] 拒绝提交不符合契约的配置', parsed.error.issues);
      setError(parsed.error.message);
      return false;
    }
    try {
      // 后端只在持久化成功后广播 config_updated；本地不预写，
      // 避免保存失败或并发即时更新时用旧快照覆盖已提交状态。
      await invoke('save_config', { newConfig: parsed.data, preserveWebMenuPins: true });
      setError(null);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  };

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    listen<unknown>('config_updated', (event) => {
      if (disposed) return;
      readVersion.current++;
      const result = readConfig(event.payload);
      setConfig(result.config);
      setError(result.error);
      setLoading(false);
    }).then((fn) => {
      if (disposed) { fn(); return; }
      unlisten = fn;
      void fetchConfig();
    }).catch((err) => {
      console.warn('Failed to listen to config_updated:', err);
      if (!disposed) void fetchConfig();
    });

    return () => {
      disposed = true;
      readVersion.current++;
      if (unlisten) unlisten();
    };
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    refreshConfig: fetchConfig,
    updateConfig,
  };
}
