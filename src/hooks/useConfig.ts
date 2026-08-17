import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../types/config';

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await invoke<AppConfig>('get_config');
      setConfig(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = async (newConfig: AppConfig): Promise<boolean> => {
    try {
      await invoke('save_config', { newConfig });
      setConfig(newConfig);
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    loading,
    error,
    refreshConfig: fetchConfig,
    updateConfig,
  };
}
