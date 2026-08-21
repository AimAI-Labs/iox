/**
 * 站点预设共享类型与 IPC 封装
 *
 * **单一数据源**：站点预设列表由 Rust 端 `src-tauri/src/site_presets.rs` 提供，
 * 前端通过 `get_site_presets` IPC 命令获取，禁止在此文件或组件内硬编码站点列表，
 * 以避免前后端漂移。
 */

import { invoke } from "@tauri-apps/api/core";

export interface SitePreset {
  /** 稳定标识符 */
  id: string;
  /** 显示名 */
  name: string;
  /** URL 模板，`{text}` 为占位符 */
  urlTemplate: string;
  /** 分类：search / ai / translate / knowledge */
  category: string;
}

/**
 * 从后端获取全部站点预设。
 * 调用此命令后，前端可直接用于下拉选择、按分类分组渲染等。
 */
export async function fetchSitePresets(): Promise<SitePreset[]> {
  return invoke<SitePreset[]>("get_site_presets");
}

/**
 * 按 id 查找预设（前端内存过滤，不发起 IPC）。
 */
export function findPresetById(
  presets: SitePreset[],
  id: string
): SitePreset | undefined {
  return presets.find((p) => p.id === id);
}

/**
 * 按 category 分组（保持原顺序）。
 */
export function groupPresetsByCategory(
  presets: SitePreset[]
): Record<string, SitePreset[]> {
  const groups: Record<string, SitePreset[]> = {};
  for (const p of presets) {
    (groups[p.category] ||= []).push(p);
  }
  return groups;
}

/** 分类显示名映射 */
export const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI 对话",
  search: "搜索",
  translate: "翻译",
  knowledge: "知识",
};
