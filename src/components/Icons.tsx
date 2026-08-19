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

export interface IconItemMeta {
  name: string;
  label: string;
  keywords?: string[];
}

/**
 * 常用 AI 品牌图标元数据列表（用于图标选择器）
 */
export const POPULAR_AI_ICONS: IconItemMeta[] = [
  { name: 'DeepSeek', label: 'DeepSeek 深度求索', keywords: ['deepseek', 'r1', 'v3', '深度求索'] },
  { name: 'OpenAI', label: 'ChatGPT / OpenAI', keywords: ['openai', 'chatgpt', 'gpt', 'gpt-4o', 'o1', 'o3'] },
  { name: 'Claude', label: 'Claude (Anthropic)', keywords: ['claude', 'anthropic', 'sonnet', 'opus', '克劳德'] },
  { name: 'Kimi', label: 'Kimi (月之暗面)', keywords: ['kimi', 'moonshot', '月之暗面'] },
  { name: 'Qwen', label: '通义千问 (Qwen)', keywords: ['qwen', 'tongyi', 'aliyun', '阿里', '通义千问'] },
  { name: 'Doubao', label: '豆包 (字节跳动)', keywords: ['doubao', 'bytedance', '字节', '豆包'] },
  { name: 'Metaso', label: '秘塔 AI 搜索', keywords: ['metaso', '秘塔', '搜索'] },
  { name: 'Perplexity', label: 'Perplexity 搜索', keywords: ['perplexity', 'ai搜索', 'pplx'] },
  { name: 'Phind', label: 'Phind 代码搜索', keywords: ['phind', 'code', '编程'] },
  { name: 'Felo', label: 'Felo 跨语种搜索', keywords: ['felo', '搜索', '跨语种'] },
  { name: 'Ai360', label: '360 AI 搜索', keywords: ['360', 'ai360', '三六零'] },
  { name: 'Ollama', label: 'Ollama 本地大模型', keywords: ['ollama', 'local', '本地', 'llama'] },
  { name: 'Gemini', label: 'Google Gemini', keywords: ['gemini', 'google', '谷歌', '双子座'] },
  { name: 'Grok', label: 'xAI Grok', keywords: ['grok', 'xai', 'elon', '马斯克'] },
  { name: 'Zhipu', label: '智谱清言 (GLM)', keywords: ['zhipu', 'chatglm', 'glm', '智谱'] },
  { name: 'Minimax', label: 'MiniMax 名之梦', keywords: ['minimax', 'abab', '名之梦'] },
  { name: 'Baichuan', label: '百川智能', keywords: ['baichuan', '百川'] },
  { name: 'Stepfun', label: '阶跃星辰 (跃问)', keywords: ['stepfun', 'step', '跃问', '阶跃星辰'] },
  { name: 'Mistral', label: 'Mistral AI', keywords: ['mistral', 'lechat', '开源'] },
  { name: 'Yi', label: '零一万物 (Yi)', keywords: ['yi', '01ai', '零一万物', '李开复'] },
  { name: 'SiliconCloud', label: '硅基流动', keywords: ['siliconcloud', '硅基流动', 'api'] },
  { name: 'OpenRouter', label: 'OpenRouter 聚合', keywords: ['openrouter', '聚合'] },
  { name: 'Groq', label: 'Groq 极速推理', keywords: ['groq', 'lpu', '极速'] },
  { name: 'DeepL', label: 'DeepL 翻译', keywords: ['deepl', 'translate', '翻译'] },
  { name: 'Cursor', label: 'Cursor AI', keywords: ['cursor', 'ide', 'code'] },
  { name: 'Trae', label: 'Trae 编程助手', keywords: ['trae', 'byte', 'code'] },
  { name: 'Windsurf', label: 'Windsurf (Codeium)', keywords: ['windsurf', 'codeium'] },
  { name: 'Hunyuan', label: '腾讯混元', keywords: ['hunyuan', 'tencent', '腾讯', '混元'] },
  { name: 'Wenxin', label: '百度文心一言', keywords: ['wenxin', 'baidu', '百度', '文心'] },
  { name: 'Spark', label: '讯飞星火', keywords: ['spark', 'iflytek', '讯飞', '星火'] },
  { name: 'LobeHub', label: 'LobeHub', keywords: ['lobe', 'lobehub'] },
];

/**
 * 常用通用功能 Lucide 图标列表（用于图标选择器）
 */
export const COMMON_FUNCTION_ICONS: IconItemMeta[] = [
  { name: 'Languages', label: '翻译 (Languages)', keywords: ['translate', 'languages', '翻译', '语言', '多语言'] },
  { name: 'FileText', label: '文档/总结 (FileText)', keywords: ['summary', 'document', 'file', '总结', '文档', '文本'] },
  { name: 'Sparkles', label: '智能/润色 (Sparkles)', keywords: ['sparkles', 'polish', 'ai', '润色', '智能', '闪光'] },
  { name: 'Terminal', label: '终端/命令行 (Terminal)', keywords: ['terminal', 'cmd', 'cli', '终端', '命令'] },
  { name: 'Code', label: '代码/编程 (Code)', keywords: ['code', 'program', 'developer', '代码', '编程'] },
  { name: 'Search', label: '搜索/查询 (Search)', keywords: ['search', 'find', '搜索', '查询', '找'] },
  { name: 'Copy', label: '复制 (Copy)', keywords: ['copy', 'clipboard', '复制', '剪贴板'] },
  { name: 'MessageSquare', label: '对话/问答 (MessageSquare)', keywords: ['chat', 'message', '对话', '问答', '消息'] },
  { name: 'Brain', label: '深度思考 (Brain)', keywords: ['brain', 'think', 'reasoning', '大脑', '思考', '推理'] },
  { name: 'Zap', label: '极速/闪电 (Zap)', keywords: ['zap', 'fast', 'speed', '极速', '快', '闪电'] },
  { name: 'Globe', label: '网页/全球 (Globe)', keywords: ['web', 'globe', 'network', '网页', '全球', '浏览器'] },
  { name: 'Bot', label: '机器人 (Bot)', keywords: ['bot', 'robot', 'assistant', '机器人', '助手'] },
  { name: 'BookOpen', label: '阅读/知识 (BookOpen)', keywords: ['book', 'read', 'learn', '阅读', '知识', '书本'] },
  { name: 'Feather', label: '写作/轻量 (Feather)', keywords: ['feather', 'write', 'light', '写作', '羽毛', '轻量'] },
  { name: 'Flame', label: '灵感/热门 (Flame)', keywords: ['flame', 'hot', 'fire', '灵感', '热门', '火焰'] },
  { name: 'PenTool', label: '创作/绘图 (PenTool)', keywords: ['pen', 'draw', 'create', '创作', '画笔', '设计'] },
  { name: 'Lightbulb', label: '创意/点子 (Lightbulb)', keywords: ['idea', 'lightbulb', 'bulb', '点子', '创意', '灯泡'] },
  { name: 'Key', label: '密钥/权限 (Key)', keywords: ['key', 'auth', 'token', '密钥', '钥匙', '权限'] },
  { name: 'ShieldCheck', label: '安全/校验 (ShieldCheck)', keywords: ['shield', 'safe', 'security', '安全', '盾牌', '校验'] },
  { name: 'Wand2', label: '魔法/转换 (Wand2)', keywords: ['magic', 'wand', 'convert', '魔法', '转换', '魔棒'] },
  { name: 'Share2', label: '分享/协作 (Share2)', keywords: ['share', 'network', '分享', '协作'] },
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
