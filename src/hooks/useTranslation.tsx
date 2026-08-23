import React, { createContext, useContext, useMemo, useCallback } from 'react';
import type { LanguageSetting } from '@/types/config';
import { translations, resolveLanguage, type TranslationKey } from '@/locales';
import { useConfig } from './useConfig';

interface I18nContextType {
  language: LanguageSetting;
  resolvedLanguage: 'zh' | 'en';
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLanguage: (newLang: LanguageSetting) => Promise<boolean>;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function formatTranslation(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in params ? String(params[key]) : match;
  });
}

export const I18nProvider: React.FC<{
  children: React.ReactNode;
  languageSetting?: LanguageSetting;
}> = ({ children, languageSetting }) => {
  const { config, updateConfig } = useConfig();

  const currentSetting: LanguageSetting = languageSetting || config?.general.language || 'auto';
  const resolvedLang = useMemo(() => resolveLanguage(currentSetting), [currentSetting]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const activeDict = translations[resolvedLang];
      let val = getNestedValue(activeDict, key as string);
      if (!val) {
        // 回退至英文或中文
        const fallbackDict = resolvedLang === 'zh' ? translations.en : translations.zh;
        val = getNestedValue(fallbackDict, key as string);
      }
      if (!val) {
        return key as string;
      }
      return formatTranslation(val, params);
    },
    [resolvedLang]
  );

  const setLanguage = useCallback(
    async (newLang: LanguageSetting): Promise<boolean> => {
      if (!config) return false;
      return await updateConfig({
        ...config,
        general: {
          ...config.general,
          language: newLang,
        },
      });
    },
    [config, updateConfig]
  );

  const value = useMemo(
    () => ({
      language: currentSetting,
      resolvedLanguage: resolvedLang,
      t,
      setLanguage,
    }),
    [currentSetting, resolvedLang, t, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (context) {
    return context;
  }

  // 备用 fallback（在未包裹 Provider 的孤立组件环境）
  const resolvedLang = resolveLanguage('auto');
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const activeDict = translations[resolvedLang];
    const val = getNestedValue(activeDict, key as string) || (key as string);
    return formatTranslation(val, params);
  };

  return {
    language: 'auto',
    resolvedLanguage: resolvedLang,
    t,
    setLanguage: async () => false,
  };
}
