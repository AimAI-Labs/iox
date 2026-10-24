import type { ProviderConfig } from '@/types/config';

/**
 * 模型解析的唯一规则：显式默认模型 → 模型列表首项 → 空串。
 *
 * 空串表示“未配置可用模型”，由调用方决定提示文案；不要把它当作模型名发给服务商。
 * Rust 端 `resolve_api_request_config` 保持同一回退顺序，两处必须一起修改。
 */
export function resolveProviderModel(provider?: ProviderConfig): string {
  return provider?.defaultModel?.trim() || provider?.models.find((model) => model.trim()) || '';
}

/**
 * 停用只影响“是否作为可选来源出现在服务商/模型选择器中”，
 * 不阻断已绑定该服务商的动作执行，因此这里只服务选择口径，不作为请求校验。
 */
export function isProviderSelectable(provider: ProviderConfig): boolean {
  return provider.enabled !== false;
}
