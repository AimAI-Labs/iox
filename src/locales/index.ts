import { zh } from './zh';
import { en } from './en';
import type { LanguageSetting } from '../types/config';

export type TranslationTree = typeof zh;

type Prev = [never, 0, 1, 2, 3, 4, 5, ...0[]];

type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${'' extends P ? '' : '.'}${P}`
    : never
  : never;

export type Leaves<T, D extends number = 4> = [D] extends [never]
  ? never
  : T extends object
  ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : '';

export type TranslationKey = Leaves<TranslationTree>;

export const translations: Record<'zh' | 'en', TranslationTree> = {
  zh,
  en,
};

/**
 * 判断当前生效的实际语言（zh 或 en）
 * 规则：如果是 'zh' 返回 'zh'；如果是 'en' 返回 'en'；
 * 如果是 'auto'，检测 navigator.languages / navigator.language，匹配以 zh 开头则返回 'zh'，其余所有情况一律回退为 'en'。
 */
export function resolveLanguage(setting: LanguageSetting = 'auto'): 'zh' | 'en' {
  if (setting === 'zh') return 'zh';
  if (setting === 'en') return 'en';

  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language || ''];
    for (const lang of langs) {
      if (/^zh(-.*)?$/i.test(lang.trim())) {
        return 'zh';
      }
    }
  }

  return 'en';
}

export { zh, en };
