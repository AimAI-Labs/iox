import React from 'react';
import {
  Sparkles,
  Search,
  Languages,
  FileText,
  Copy,
  MessageSquare,
  Bot,
  HelpCircle,
  Settings,
  Wand2,
  Globe,
  Cpu,
  LayoutTemplate,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Check,
  RotateCw,
  ExternalLink,
  Pin,
  PinOff,
  X,
  Send,
  Square,
  ChevronDown,
  AlertCircle,
  GripVertical,
  MoreHorizontal,
  Box,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Code,
  Compass,
  BookOpen,
  Feather,
  Flame,
  Zap,
  Brain,
  PenTool,
  Share2,
  Key,
  FileCheck,
  Lightbulb,
  type LucideProps,
} from 'lucide-react';

import {
  DeepSeek,
  OpenAI,
  Claude,
  Anthropic,
  Moonshot,
  Qwen,
  Doubao,
  ByteDance,
  Perplexity,
  Phind,
  Ai360,
  Ollama,
  Gemini,
  Google,
  Grok,
  XAI,
  Zhipu,
  ChatGLM,
  Minimax,
  Baichuan,
  Stepfun,
  Mistral,
  Yi,
  SiliconCloud,
  OpenRouter,
  Groq,
  Together,
  Fireworks,
  DeepL,
  Cursor,
  Trae,
  Windsurf,
  Hunyuan,
  Tencent,
  Wenxin,
  Baidu,
  Spark,
  Cohere,
  LobeHub,
} from '@lobehub/icons';

export interface IconProps {
  name: string;
  className?: string;
  size?: number;
  mono?: boolean;
}

/**
 * Kimi 专用高对比度矢量图标（主体使用黑色 / 自适应前景色，右上角为经典 Kimi 蓝）
 */
const KimiMono: React.FC<{ size?: number | string; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z" />
    <path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z" />
  </svg>
);

const KimiColor: React.FC<{ size?: number | string; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z"
      fill="#1783FF"
    />
    <path
      d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z"
      fill="currentColor"
    />
  </svg>
);

const Kimi: any = KimiMono;
Kimi.Color = KimiColor;

/**
 * 秘塔 AI 专用高精度矢量图标
 */
const MetasoMono: React.FC<{ size?: number | string; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z"
      fill="currentColor"
    />
  </svg>
);

const MetasoColor: React.FC<{ size?: number | string; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z"
      fill="url(#metaso-grad)"
    />
    <defs>
      <linearGradient id="metaso-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="0.5" stopColor="#6366F1" />
        <stop offset="1" stopColor="#A855F7" />
      </linearGradient>
    </defs>
  </svg>
);

const Metaso: any = MetasoMono;
Metaso.Color = MetasoColor;

/**
 * Felo AI 搜索专用矢量图标
 */
const FeloMono: React.FC<{ size?: number | string; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
    <ellipse cx="12" cy="12" rx="4.5" ry="9" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3.5 12H20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const FeloColor: React.FC<{ size?: number | string; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="12" cy="12" r="9" stroke="url(#felo-grad)" strokeWidth="2.2" />
    <ellipse cx="12" cy="12" rx="4.5" ry="9" stroke="url(#felo-grad)" strokeWidth="1.8" />
    <path d="M3.5 12H20.5" stroke="url(#felo-grad)" strokeWidth="1.8" strokeLinecap="round" />
    <defs>
      <linearGradient id="felo-grad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#06B6D4" />
        <stop offset="1" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
  </svg>
);

const Felo: any = FeloMono;
Felo.Color = FeloColor;

/**
 * LobeHub AI 官方矢量品牌图标映射表
 */
const AI_ICON_MAP: Record<string, any> = {
  DeepSeek,
  OpenAI,
  Claude,
  Anthropic,
  Kimi,
  Moonshot,
  Qwen,
  Doubao,
  ByteDance,
  Metaso,
  Perplexity,
  Phind,
  Felo,
  Ai360,
  Ollama,
  Gemini,
  Google,
  Grok,
  XAI,
  Zhipu,
  ChatGLM,
  Minimax,
  Baichuan,
  Stepfun,
  Mistral,
  Yi,
  SiliconCloud,
  OpenRouter,
  Groq,
  Together,
  Fireworks,
  DeepL,
  Cursor,
  Trae,
  Windsurf,
  Hunyuan,
  Tencent,
  Wenxin,
  Baidu,
  Spark,
  Cohere,
  LobeHub,
};

/**
 * 显式 Lucide 通用功能图标映射表
 */
const LUCIDE_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Sparkles,
  Search,
  Languages,
  FileText,
  Copy,
  MessageSquare,
  Bot,
  HelpCircle,
  Settings,
  Wand2,
  Globe,
  Cpu,
  LayoutTemplate,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Check,
  RotateCw,
  ExternalLink,
  Pin,
  PinOff,
  X,
  Send,
  Square,
  ChevronDown,
  AlertCircle,
  GripVertical,
  MoreHorizontal,
  Box,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Code,
  Compass,
  BookOpen,
  Feather,
  Flame,
  Zap,
  Brain,
  PenTool,
  Share2,
  Key,
  FileCheck,
  Lightbulb,
};

/**
 * 语义与常用简写别名映射（支持小写/中文/模型代号）
 */
const ALIAS_MAP: Record<string, string> = {
  // AI 品牌映射
  deepseek: 'DeepSeek',
  'deepseek-chat': 'DeepSeek',
  'deepseek-reasoner': 'DeepSeek',
  'deepseek-r1': 'DeepSeek',
  'deepseek-v3': 'DeepSeek',
  openai: 'OpenAI',
  chatgpt: 'OpenAI',
  ChatGPT: 'OpenAI',
  'gpt-4': 'OpenAI',
  'gpt-4o': 'OpenAI',
  claude: 'Claude',
  anthropic: 'Claude',
  kimi: 'Kimi',
  moonshot: 'Moonshot',
  qwen: 'Qwen',
  tongyi: 'Qwen',
  Tongyi: 'Qwen',
  'qwen-plus': 'Qwen',
  'qwen-max': 'Qwen',
  doubao: 'Doubao',
  bytedance: 'Doubao',
  metaso: 'Metaso',
  'meta-so': 'Metaso',
  perplexity: 'Perplexity',
  phind: 'Phind',
  felo: 'Felo',
  '360': 'Ai360',
  'ai-360': 'Ai360',
  ai360: 'Ai360',
  ollama: 'Ollama',
  gemini: 'Gemini',
  google: 'Gemini',
  grok: 'Grok',
  xai: 'Grok',
  zhipu: 'Zhipu',
  glm: 'Zhipu',
  chatglm: 'Zhipu',
  minimax: 'Minimax',
  baichuan: 'Baichuan',
  stepfun: 'Stepfun',
  mistral: 'Mistral',
  yi: 'Yi',
  siliconcloud: 'SiliconCloud',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  together: 'Together',
  fireworks: 'Fireworks',
  deepl: 'DeepL',
  cursor: 'Cursor',
  trae: 'Trae',
  windsurf: 'Windsurf',
  hunyuan: 'Hunyuan',
  wenxin: 'Wenxin',
  baidu: 'Wenxin',
  spark: 'Spark',

  // 通用功能别名
  Translate: 'Languages',
  Summary: 'FileText',
  Chat: 'MessageSquare',
  AiSearch: 'Search',
  Web: 'Globe',
  Model: 'Cpu',
  Prompt: 'FileText',
};

/**
 * 常用 AI 品牌图标元数据列表（用于设置面板的快捷选择）
 */
export const POPULAR_AI_ICONS = [
  { name: 'DeepSeek', label: 'DeepSeek 深度求索' },
  { name: 'OpenAI', label: 'ChatGPT / OpenAI' },
  { name: 'Claude', label: 'Claude (Anthropic)' },
  { name: 'Kimi', label: 'Kimi (月之暗面)' },
  { name: 'Qwen', label: '通义千问 (Qwen)' },
  { name: 'Doubao', label: '豆包 (字节跳动)' },
  { name: 'Metaso', label: '秘塔 AI' },
  { name: 'Perplexity', label: 'Perplexity 搜索' },
  { name: 'Phind', label: 'Phind 代码搜索' },
  { name: 'Felo', label: 'Felo 跨语种搜索' },
  { name: 'Ai360', label: '360 AI 搜索' },
  { name: 'Ollama', label: 'Ollama 本地' },
  { name: 'Gemini', label: 'Google Gemini' },
  { name: 'Grok', label: 'xAI Grok' },
  { name: 'Zhipu', label: '智谱清言 (GLM)' },
  { name: 'Minimax', label: 'MiniMax' },
  { name: 'DeepL', label: 'DeepL 翻译' },
];

/**
 * 常用通用功能 Lucide 图标列表
 */
export const COMMON_FUNCTION_ICONS = [
  { name: 'Languages', label: '翻译' },
  { name: 'FileText', label: '文档/总结' },
  { name: 'Sparkles', label: '智能/润色' },
  { name: 'Terminal', label: '代码/终端' },
  { name: 'Search', label: '搜索' },
  { name: 'Copy', label: '复制' },
  { name: 'Globe', label: '网页/全球' },
  { name: 'Bot', label: '机器人' },
  { name: 'MessageSquare', label: '对话' },
  { name: 'Zap', label: '极速/闪电' },
  { name: 'Brain', label: '思考/大脑' },
  { name: 'Code', label: '代码' },
];

/**
 * 智能动态图标组件：
 * 1. 优先匹配 LobeHub AI 品牌矢量图标，默认展示官方原生色彩 (.Color)，提供高辨识度；
 * 2. 匹配 Lucide 通用矢量图标；
 * 3. 缺省回退至 Sparkles。
 */
export const DynamicIcon: React.FC<IconProps> = ({
  name,
  className = '',
  size = 16,
  mono = false,
}) => {
  if (!name) {
    return <Sparkles size={size} className={className} />;
  }

  // 1. 归一化解析别名
  const resolvedName = ALIAS_MAP[name] || ALIAS_MAP[name.toLowerCase()] || name;

  // 2. 尝试匹配 LobeHub AI 品牌图标
  const AiComponent = AI_ICON_MAP[resolvedName] || AI_ICON_MAP[name];
  if (AiComponent) {
    if (!mono && AiComponent.Color) {
      const ColorComponent = AiComponent.Color;
      return <ColorComponent size={size} className={className} />;
    }
    return <AiComponent size={size} className={className} />;
  }

  // 3. 尝试匹配 Lucide 通用图标
  const LucideComponent =
    LUCIDE_ICON_MAP[resolvedName] || LUCIDE_ICON_MAP[name] || Sparkles;

  return <LucideComponent size={size} className={className} />;
};
